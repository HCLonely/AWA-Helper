/** Verified release download and deferred in-place installation. */
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { spawn } from 'child_process';
import { pipeline } from 'stream/promises';
import * as tar from 'tar';
import { http } from '../http';
import { formatProxy } from '../proxy';
import { getReleaseCheck, type ReleaseAsset } from './version';
import { withGitHubFallback } from './github';
import { ProcessLock } from '../process/ProcessLock';

type UpdateErrorCode = 'ALREADY_SCHEDULED' | 'UP_TO_DATE' | 'UNSUPPORTED_PLATFORM' |
  'ASSET_NOT_FOUND' | 'UNVERIFIED_ASSET' | 'INTEGRITY_MISMATCH' | 'INVALID_ARCHIVE';

interface ScheduleUpdateOptions {
  currentVersion: string
  proxy?: proxy
  restart: boolean
}

interface ScheduledUpdate {
  version: string
  assetName: string
  releaseUrl: string
  delegated?: boolean
}

class UpdateInstallerError extends Error {
  constructor(readonly code: UpdateErrorCode, message: string) {
    super(message);
    this.name = 'UpdateInstallerError';
  }
}

let scheduled = false;
let scheduling = false;

const isSourceRuntime = (scriptPath = process.argv[1] || ''): boolean => /\.[cm]?js$/i.test(scriptPath);

const getAssetNameForRuntime = (
  platform = os.type(),
  architecture = os.arch(),
  sourceRuntime = isSourceRuntime()
): string => {
  if (sourceRuntime) {
    return 'index.js';
  }
  if (platform === 'Windows_NT' && architecture === 'x64') {
    return 'AWA-Helper-Win.tar.gz';
  }
  if (platform === 'Linux') {
    const architectureNames: Partial<Record<typeof architecture, string>> = {
      x64: 'x64',
      arm: 'armv7',
      arm64: 'armv8'
    };
    const suffix = architectureNames[architecture];
    if (suffix) {
      return `AWA-Helper-Linux-${suffix}.tar.gz`;
    }
  }
  throw new UpdateInstallerError('UNSUPPORTED_PLATFORM', `Updates are not available for ${platform}/${architecture}`);
};

const digestFile = async (filePath: string): Promise<string> => await new Promise((resolve, reject) => {
  const hash = crypto.createHash('sha256');
  const input = fs.createReadStream(filePath);
  input.on('error', reject);
  input.on('data', (chunk) => hash.update(chunk));
  input.on('end', () => resolve(hash.digest('hex')));
});

const downloadAsset = async (asset: ReleaseAsset, destination: string, proxy?: proxy): Promise<void> => {
  const digest = asset.digest?.match(/^sha256:([a-f\d]{64})$/i)?.[1]?.toLowerCase();
  if (!digest) {
    throw new UpdateInstallerError('UNVERIFIED_ASSET', `Release asset ${asset.name} has no SHA-256 digest`);
  }
  const options: myAxiosConfig = {
    responseType: 'stream',
    timeout: 5 * 60 * 1000,
    retryTimes: 1,
    maxContentLength: asset.size
  };
  if (proxy?.enable?.includes('github') && proxy.host && proxy.port) {
    options.httpsAgent = formatProxy(proxy);
  }
  await withGitHubFallback(asset.browserDownloadUrl, async (url) => {
    try {
      const response = await http.get(url, options);
      await pipeline(response.data, fs.createWriteStream(destination, { flags: 'wx' }));
      const stat = fs.statSync(destination);
      if (stat.size !== asset.size || await digestFile(destination) !== digest) {
        throw new UpdateInstallerError('INTEGRITY_MISMATCH', `SHA-256 verification failed for ${asset.name}`);
      }
    } catch (error) {
      fs.rmSync(destination, { force: true });
      throw error;
    }
  });
};

const safeRelativePath = (entryPath: string): string => {
  const normalized = entryPath.replace(/\\/g, '/').replace(/^\.\//, '');
  const segments = normalized.split('/').filter(Boolean);
  if (!normalized || normalized.startsWith('/') || /^[A-Za-z]:/.test(normalized) || segments.includes('..')) {
    throw new UpdateInstallerError('INVALID_ARCHIVE', `Unsafe archive path: ${entryPath}`);
  }
  if (segments[0] !== 'output') {
    throw new UpdateInstallerError('INVALID_ARCHIVE', `Unexpected archive root: ${entryPath}`);
  }
  return segments.join('/');
};

const extractArchive = async (archivePath: string, destination: string): Promise<string> => {
  let entryCount = 0;
  let unpackedBytes = 0;
  await tar.t({
    file: archivePath,
    strict: true,
    onentry: (entry) => {
      entryCount++;
      unpackedBytes += entry.size || 0;
      if (entryCount > 10_000 || unpackedBytes > 1024 * 1024 * 1024) {
        throw new UpdateInstallerError('INVALID_ARCHIVE', 'Release archive exceeds the extraction safety limit');
      }
      safeRelativePath(entry.path);
      if (!['File', 'OldFile', 'Directory'].includes(entry.type)) {
        throw new UpdateInstallerError('INVALID_ARCHIVE', `Archive links and special files are not allowed: ${entry.path}`);
      }
    }
  });
  await tar.x({ file: archivePath, cwd: destination, strict: true, preservePaths: false });
  const packageRoot = path.join(destination, 'output');
  if (!fs.statSync(packageRoot, { throwIfNoEntry: false })?.isDirectory()) {
    throw new UpdateInstallerError('INVALID_ARCHIVE', 'Release archive does not contain an output directory');
  }
  return packageRoot;
};

const copyExistingFiles = (sourceRoot: string, installRoot: string, backupRoot: string, relative = ''): void => {
  const sourceDirectory = path.join(sourceRoot, relative);
  for (const entry of fs.readdirSync(sourceDirectory, { withFileTypes: true })) {
    const childRelative = path.join(relative, entry.name);
    const target = path.resolve(installRoot, childRelative);
    if (!target.startsWith(`${path.resolve(installRoot)}${path.sep}`)) {
      throw new UpdateInstallerError('INVALID_ARCHIVE', `Update target escapes the installation directory: ${childRelative}`);
    }
    if (entry.isSymbolicLink()) {
      throw new UpdateInstallerError('INVALID_ARCHIVE', `Package symlinks are not allowed: ${childRelative}`);
    }
    if (entry.isDirectory()) {
      copyExistingFiles(sourceRoot, installRoot, backupRoot, childRelative);
    } else if (entry.isFile() && fs.statSync(target, { throwIfNoEntry: false })?.isFile()) {
      const backup = path.join(backupRoot, childRelative);
      fs.mkdirSync(path.dirname(backup), { recursive: true });
      fs.copyFileSync(target, backup);
    }
  }
};

const psQuote = (value: string): string => `'${value.replace(/'/g, '\'\'')}'`;
const shQuote = (value: string): string => `'${value.replace(/'/g, String.raw`'"'"'`)}'`;

const restartCommand = (): { command: string; args: string[] } => {
  if (os.type() === 'Windows_NT' && process.argv.includes('--tray-child') && !isSourceRuntime()) {
    return { command: path.join(path.dirname(process.execPath), 'AWA-Manager.exe'), args: [] };
  }
  const args = ['--manager'];
  if (process.argv.includes('--tray-child')) {
    args.push('--tray-child');
  }
  if (isSourceRuntime()) {
    return { command: process.execPath, args: [path.resolve(process.argv[1]), ...args] };
  }
  return { command: process.execPath, args };
};

const writeWindowsUpdater = (stageRoot: string, sourceRoot: string, installRoot: string, backupRoot: string, restart: boolean): string => {
  const scriptPath = path.join(stageRoot, 'apply-update.ps1');
  const restartSpec = restartCommand();
  const restartArguments = restartSpec.args.length > 0
    ? ` -ArgumentList @(${restartSpec.args.map(psQuote).join(', ')})`
    : '';
  const restartLines = restart
    ? `Start-Process -FilePath ${psQuote(restartSpec.command)}${restartArguments} -WorkingDirectory ${psQuote(installRoot)} -WindowStyle Hidden`
    : '';
  const waitPids = process.argv.includes('--tray-child') ? `${process.pid}, ${process.ppid}` : String(process.pid);
  fs.writeFileSync(scriptPath, `$ErrorActionPreference = 'Stop'
$source = ${psQuote(sourceRoot)}
$target = ${psQuote(installRoot)}
$backup = ${psQuote(backupRoot)}
try { Wait-Process -Id ${waitPids} -ErrorAction SilentlyContinue } catch {}
try {
  Get-ChildItem -LiteralPath $source -Force | Copy-Item -Destination $target -Recurse -Force
  Set-Content -LiteralPath ${psQuote(path.join(path.dirname(stageRoot), 'last-result.json'))} -Value '{"status":"success"}'
  ${restartLines}
  Set-Content -LiteralPath ${psQuote(path.join(stageRoot, 'completed.json'))} -Value '{"status":"success"}' -Encoding ASCII
} catch {
  if (Test-Path -LiteralPath $backup) {
    Get-ChildItem -LiteralPath $backup -Force | Copy-Item -Destination $target -Recurse -Force
  }
  Set-Content -LiteralPath ${psQuote(path.join(path.dirname(stageRoot), 'last-result.json'))} -Value ('{"status":"failed","error":' + (ConvertTo-Json $_.Exception.Message -Compress) + '}')
  exit 1
} finally {
  Remove-Item -LiteralPath ${psQuote(path.join(installRoot, '.update', 'install.lock'))} -Force -ErrorAction SilentlyContinue
}
`);
  return scriptPath;
};

const writeLinuxUpdater = (stageRoot: string, sourceRoot: string, installRoot: string, backupRoot: string, restart: boolean): string => {
  const scriptPath = path.join(stageRoot, 'apply-update.sh');
  const restartSpec = restartCommand();
  const restartLine = restart
    ? `cd ${shQuote(installRoot)}\nnohup ${[restartSpec.command, ...restartSpec.args].map(shQuote).join(' ')} >/dev/null 2>&1 &`
    : '';
  fs.writeFileSync(scriptPath, `#!/bin/sh
while kill -0 ${process.pid} 2>/dev/null; do sleep 1; done
if cp -a ${shQuote(`${sourceRoot}${path.sep}.`)} ${shQuote(installRoot)}; then
  printf '%s' '{"status":"success"}' > ${shQuote(path.join(path.dirname(stageRoot), 'last-result.json'))}
  ${restartLine}
  printf '%s' '{"status":"success"}' > ${shQuote(path.join(stageRoot, 'completed.json'))}
else
  cp -a ${shQuote(`${backupRoot}${path.sep}.`)} ${shQuote(installRoot)} 2>/dev/null || true
  printf '%s' '{"status":"failed"}' > ${shQuote(path.join(path.dirname(stageRoot), 'last-result.json'))}
  exit 1
fi
`, { mode: 0o700 });
  return scriptPath;
};

const launchUpdater = (scriptPath: string): number => {
  const windowsPowerShell = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
  const command = os.type() === 'Windows_NT' ? windowsPowerShell : '/bin/sh';
  if (!fs.existsSync(command)) {
    throw new Error(`Unable to launch updater: ${command} was not found`);
  }
  const child = os.type() === 'Windows_NT'
    ? spawn(command, ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', scriptPath], {
      detached: true, windowsHide: true, stdio: 'ignore'
    })
    : spawn(command, [scriptPath], { detached: true, stdio: 'ignore' });
  child.once('error', () => { /* The detached updater records failures in .update/last-result.json. */ });
  child.unref();
  if (!child.pid) {
    throw new Error('Unable to start the update installer');
  }
  return child.pid;
};

export const scheduleUpdate = async ({ currentVersion, proxy, restart }: ScheduleUpdateOptions): Promise<ScheduledUpdate> => {
  if (os.type() === 'Windows_NT' && process.argv.includes('--tray-child')) {
    if (process.stdout.destroyed || !process.stdout.writable) {
      throw new Error('Unable to coordinate the update with AWA-Manager');
    }
    process.stdout.write('@@AWA-TRAY\tUPDATE_REQUEST\n');
    return { version: currentVersion, assetName: 'AWA-Helper-Win.tar.gz', releaseUrl: 'https://github.com/HCLonely/AWA-Helper/releases/latest', delegated: true };
  }
  if (scheduled || scheduling) {
    throw new UpdateInstallerError('ALREADY_SCHEDULED', 'An update has already been scheduled');
  }
  scheduling = true;
  let stageRoot: string | undefined;
  const installLock = os.type() === 'Windows_NT' ? new ProcessLock(path.resolve('.update/install.lock')) : undefined;
  try {
    if (installLock && !await installLock.acquire()) {
      throw new UpdateInstallerError('ALREADY_SCHEDULED', 'Another installer is running');
    }
    if (os.type() === 'Windows_NT') {
      const trayPath = path.resolve('.update/tray.json');
      if (fs.existsSync(trayPath)) {
        const { pid } = JSON.parse(fs.readFileSync(trayPath, 'utf8')) as { pid?: number };
        let trayAlive = false;
        if (Number.isSafeInteger(pid) && (pid || 0) > 0) {
          try {
            process.kill(pid!, 0);
            trayAlive = true;
          } catch (error) {
            trayAlive = (error as NodeJS.ErrnoException).code === 'EPERM';
          }
        }
        if (trayAlive) {
          throw new UpdateInstallerError('ALREADY_SCHEDULED', 'AWA-Manager is running; use its 检查更新 menu');
        }
      }
    }
    const release = await getReleaseCheck(currentVersion, proxy, true);
    if (!release.updateAvailable) {
      throw new UpdateInstallerError('UP_TO_DATE', 'AWA-Helper is already up to date');
    }
    const assetName = getAssetNameForRuntime();
    const asset = release.assets.find((candidate) => candidate.name === assetName);
    if (!asset) {
      throw new UpdateInstallerError('ASSET_NOT_FOUND', `Release ${release.version} does not contain ${assetName}`);
    }

    const updateRoot = path.resolve('.update');
    stageRoot = path.join(updateRoot, `staging-${release.version}-${crypto.randomUUID()}`);
    const payloadRoot = path.join(stageRoot, 'payload');
    const backupRoot = path.join(stageRoot, 'backup');
    const installRoot = path.resolve('.');
    fs.mkdirSync(payloadRoot, { recursive: true });
    fs.mkdirSync(backupRoot, { recursive: true });
    const downloadPath = path.join(stageRoot, asset.name);
    await downloadAsset(asset, downloadPath, proxy);
    let sourceRoot: string;
    if (isSourceRuntime()) {
      sourceRoot = payloadRoot;
      fs.copyFileSync(downloadPath, path.join(payloadRoot, path.basename(path.resolve(process.argv[1]))));
    } else {
      sourceRoot = await extractArchive(downloadPath, payloadRoot);
    }
    copyExistingFiles(sourceRoot, installRoot, backupRoot);
    const scriptPath = os.type() === 'Windows_NT'
      ? writeWindowsUpdater(stageRoot, sourceRoot, installRoot, backupRoot, restart)
      : writeLinuxUpdater(stageRoot, sourceRoot, installRoot, backupRoot, restart);
    const coordinateTray = restart && process.argv.includes('--tray-child');
    if (coordinateTray && (process.stdout.destroyed || !process.stdout.writable)) {
      throw new Error('Unable to coordinate the update with AWA-Manager');
    }
    const installerPid = launchUpdater(scriptPath);
    if (installLock) {
      // The deferred installer waits for this process and removes the lock in finally.
      fs.writeFileSync(path.resolve('.update/install.lock'), JSON.stringify({ pid: installerPid, startedAt: new Date().toISOString() }));
    }
    scheduled = true;
    if (coordinateTray) {
      process.stdout.write('@@AWA-TRAY\tUPDATE\n');
    }
    return { version: release.version, assetName, releaseUrl: release.releaseUrl };
  } catch (error) {
    await installLock?.release();
    if (stageRoot) {
      fs.rmSync(stageRoot, { recursive: true, force: true });
    }
    throw error;
  } finally {
    scheduling = false;
  }
};

export { getAssetNameForRuntime, isSourceRuntime, safeRelativePath, UpdateInstallerError };
export type { ScheduleUpdateOptions, ScheduledUpdate, UpdateErrorCode };
