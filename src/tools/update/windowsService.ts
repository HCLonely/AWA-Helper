/** Windows 服务更新：通过任务计划程序让安装器独立于 WinSW 的进程树运行。 */
import * as fs from 'fs';
import * as path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execute = promisify(execFile);
const psQuote = (value: string): string => `'${value.replace(/'/g, '\'\'')}'`;
const powerShell = (): string => path.join(process.env.SystemRoot || 'C:\\Windows', 'System32/WindowsPowerShell/v1.0/powershell.exe');
type RunPowerShell = (script: string) => Promise<string>;

const runPowerShell: RunPowerShell = async (script) => {
  const result = await execute(powerShell(), ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass',
    '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64')], {
    windowsHide: true,
    timeout: 30_000,
    maxBuffer: 1024 * 1024
  });
  return result.stdout.trim();
};

export interface WindowsServiceIdentity {
  name: 'AWAHelper'
  managerPid: number
  wrapperPid: number
}

/** 同时验证 SCM、WinSW XML 以及父子进程，防止残留注册文件误判或操作其他目录。 */
const identityFunctions = `
function Assert-UpdateService {
  $definition = Get-CimInstance Win32_Service -Filter "Name='AWAHelper'" -ErrorAction Stop
  if (-not $definition -or [int]$definition.ProcessId -ne $wrapperPid) {
    throw 'The AWAHelper service identity changed; no service was modified.'
  }
  $wrapper = [IO.Path]::GetFullPath((Join-Path $target '.service\\AWAHelperService.exe'))
  foreach ($file in @($target, (Join-Path $target '.service'), $wrapper,
      (Join-Path $target '.service\\AWAHelperService.xml'), (Join-Path $target 'AWA-Helper.exe'))) {
    if ((Get-Item -LiteralPath $file -Force -ErrorAction Stop).Attributes -band [IO.FileAttributes]::ReparsePoint) {
      throw 'Service update paths must not contain reparse points.'
    }
  }
  $image = [Environment]::ExpandEnvironmentVariables([string]$definition.PathName).Trim()
  $parent = Get-Process -Id $wrapperPid -ErrorAction Stop
  if ($parent.Path -ne $wrapper) { throw 'The running wrapper image does not match SCM.' }
  if ($image -ne $wrapper -and $image -ne ('"' + $wrapper + '"')) {
    throw 'The service wrapper belongs to another installation.'
  }
  $manager = Get-CimInstance Win32_Process -Filter "ProcessId=$managerPid" -ErrorAction Stop
  $expected = [IO.Path]::GetFullPath((Join-Path $target 'AWA-Helper.exe'))
  if (-not $manager -or [int]$manager.ParentProcessId -ne $wrapperPid -or
      [string]$manager.ExecutablePath -ne $expected) {
    throw 'The Manager process does not belong to this service.'
  }
  $settings = New-Object Xml.XmlReaderSettings
  $settings.DtdProcessing = [Xml.DtdProcessing]::Prohibit
  $settings.XmlResolver = $null
  $serviceDir = Join-Path $target '.service'
  $reader = [Xml.XmlReader]::Create((Join-Path $serviceDir 'AWAHelperService.xml'), $settings)
  try {
    $document = New-Object Xml.XmlDocument
    $document.XmlResolver = $null
    $document.Load($reader)
  } finally { $reader.Dispose() }
  $application = [Environment]::ExpandEnvironmentVariables(([string]$document.service.executable).Replace('%BASE%', $serviceDir))
  if (-not [IO.Path]::IsPathRooted($application)) { $application = Join-Path $serviceDir $application }
  if ([string]$document.service.id -ne 'AWAHelper' -or [IO.Path]::GetFullPath($application) -ne $expected -or
      (([string]$document.service.arguments).Trim() -replace '\\s+', ' ') -notin @('--manager', '--manager --no-update')) {
    throw 'The WinSW configuration does not match this Manager installation.'
  }
}
`;

export const detectWindowsService = async (
  installRoot: string, managerPid = process.pid, wrapperPid = process.ppid, run: RunPowerShell = runPowerShell
): Promise<WindowsServiceIdentity | undefined> => {
  const result = await run(`$ErrorActionPreference = 'Stop'
$target = ${psQuote(installRoot)}
$managerPid = ${managerPid}
$wrapperPid = ${wrapperPid}
${identityFunctions}
$parent = Get-Process -Id $wrapperPid -ErrorAction SilentlyContinue
if ($parent -and $parent.Path -and [IO.Path]::GetFileName($parent.Path) -in @('explorer.exe', 'cmd.exe', 'powershell.exe', 'pwsh.exe', 'node.exe', 'AWA-Manager.exe')) { exit 0 }
$parentService = @(Get-CimInstance Win32_Service -Filter "ProcessId = ${wrapperPid}" -ErrorAction Stop)
if ($parentService.Count -eq 0) {
  if ($parent -and $parent.Path -like '*AWAHelperService.exe') { throw 'WinSW parent is not registered with SCM.' }
  if (-not $parent -and (Test-Path -LiteralPath (Join-Path $target '.service\\AWAHelperService.xml'))) { throw 'Cannot verify the service parent.' }
  exit 0
}
if ($parentService.Count -ne 1 -or $parentService[0].Name -ne 'AWAHelper') {
  throw 'Unsupported service host; use its service update command.'
}
Assert-UpdateService
@{ name = 'AWAHelper'; managerPid = $managerPid; wrapperPid = $wrapperPid } | ConvertTo-Json -Compress
`);
  if (!result) {
    return undefined;
  }
  const identity = JSON.parse(result) as WindowsServiceIdentity;
  if (identity.name !== 'AWAHelper' || identity.managerPid !== managerPid || identity.wrapperPid !== wrapperPid) {
    throw new Error('Invalid service update identity');
  }
  return identity;
};

const taskFunctions = `
function Remove-UpdateTask {
  $scheduler = New-Object -ComObject Schedule.Service
  $scheduler.Connect()
  $scheduler.GetFolder('\\').DeleteTask($taskName, 0)
}
`;

export const renderTaskRegistration = (taskName: string, scriptPath: string, installRoot: string): string => `
$ErrorActionPreference = 'Stop'
$scheduler = New-Object -ComObject Schedule.Service
$scheduler.Connect()
$definition = $scheduler.NewTask(0)
$definition.RegistrationInfo.Description = 'AWA-Helper one-time service update'
$definition.Principal.UserId = 'SYSTEM'
$definition.Principal.LogonType = 5
$definition.Principal.RunLevel = 1
$definition.Settings.Hidden = $true
$definition.Settings.ExecutionTimeLimit = 'PT10M'
$definition.Settings.DisallowStartIfOnBatteries = $false
$definition.Settings.StopIfGoingOnBatteries = $false
$action = $definition.Actions.Create(0)
$action.Path = ${psQuote(powerShell())}
$action.Arguments = ${psQuote(`-NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File "${scriptPath}"`)}
$action.WorkingDirectory = ${psQuote(installRoot)}
$task = $scheduler.GetFolder('\\').RegisterTaskDefinition(${psQuote(taskName)}, $definition, 2, 'SYSTEM', $null, 5)
$null = $task.Run($null)
`;

interface ServiceUpdaterOptions {
  stageRoot: string
  sourceRoot: string
  installRoot: string
  backupRoot: string
  identity: WindowsServiceIdentity
  taskName: string
  restart: boolean
  healthcheck?: boolean
}

/** 任务先报告 PID，再等待 HTTP 响应完成的交接文件；未交接时绝不停止服务。 */
export const renderWindowsServiceUpdater = (options: ServiceUpdaterOptions): string => {
  const {
    stageRoot, sourceRoot, installRoot, backupRoot, identity, taskName, restart
  } = options;
  return `$ErrorActionPreference = 'Stop'
$target = ${psQuote(installRoot)}
$source = ${psQuote(sourceRoot)}
$backup = ${psQuote(backupRoot)}
$stage = ${psQuote(stageRoot)}
$taskName = ${psQuote(taskName)}
$managerPid = ${identity.managerPid}
$wrapperPid = ${identity.wrapperPid}
$resultPath = Join-Path (Split-Path $stage) 'last-result.json'
$lockPath = Join-Path (Split-Path $stage) 'install.lock'
${identityFunctions}
${taskFunctions}
function Wait-UpdateService([string]$status) {
  (Get-Service -Name 'AWAHelper' -ErrorAction Stop).WaitForStatus($status, [TimeSpan]::FromSeconds(90))
}
function Request-UpdateService([string]$action) {
  $controller = Get-Service -Name 'AWAHelper' -ErrorAction Stop
  if ($action -eq 'Stop') {
    if ($controller.Status -ne 'Stopped' -and $controller.Status -ne 'StopPending') { $controller.Stop() }
  } elseif ($controller.Status -ne 'Running' -and $controller.Status -ne 'StartPending') { $controller.Start() }
}
function Wait-UpdateReady {
  $deadline = [DateTime]::UtcNow.AddSeconds(90)
  $stableSince = $null
  $stablePid = 0
  while ([DateTime]::UtcNow -lt $deadline) {
    $definition = Get-CimInstance Win32_Service -Filter "Name='AWAHelper'" -ErrorAction Stop
    $children = @(Get-CimInstance Win32_Process -Filter "ParentProcessId=$($definition.ProcessId)" -ErrorAction Stop |
      Where-Object { $_.ExecutablePath -eq (Join-Path $target 'AWA-Helper.exe') })
    $healthy = $definition.State -eq 'Running' -and $children.Count -eq 1
    if ($healthy -and $stablePid -ne [int]$children[0].ProcessId) {
      $stablePid = [int]$children[0].ProcessId
      $stableSince = $null
    }
    ${options.healthcheck === false ? '' : `if ($healthy) {
      $start = New-Object Diagnostics.ProcessStartInfo
      $start.FileName = Join-Path $target 'AWA-Helper.exe'
      $start.Arguments = '--healthcheck'
      $start.WorkingDirectory = $target
      $start.UseShellExecute = $false
      $start.CreateNoWindow = $true
      $start.RedirectStandardOutput = $true
      $start.RedirectStandardError = $true
      $probe = [Diagnostics.Process]::Start($start)
      try {
        if (-not $probe.WaitForExit(5000)) { $probe.Kill(); $healthy = $false }
        else { $healthy = $probe.ExitCode -eq 0 }
      } finally { $probe.Dispose() }
    }`}
    if ($healthy) {
      if (-not $stableSince) { $stableSince = [DateTime]::UtcNow }
      if (([DateTime]::UtcNow - $stableSince).TotalSeconds -ge 2) { return }
    } else { $stableSince = $null }
    Start-Sleep -Milliseconds 500
  }
  throw 'The updated Manager did not become healthy within 90 seconds.'
}
function Wait-UpdateManager {
  $manager = Get-Process -Id $managerPid -ErrorAction SilentlyContinue
  if ($manager -and -not $manager.WaitForExit(90000)) { throw 'The old Manager did not exit.' }
}
function Write-UpdateJson([string]$file, $value) {
  $json = ConvertTo-Json -InputObject $value -Compress -Depth 5
  [IO.File]::WriteAllText($file, $json, (New-Object Text.UTF8Encoding($false)))
}
# BEGIN UPDATE TRANSACTION
$stopped = $false
$copyStarted = $false
$introducedFiles = @()
try {
  Assert-UpdateService
  Write-UpdateJson (Join-Path $stage 'ready.json') @{ pid = $PID }
  $deadline = [DateTime]::UtcNow.AddSeconds(45)
  while (-not (Test-Path -LiteralPath (Join-Path $stage 'handoff.json'))) {
    if ([DateTime]::UtcNow -gt $deadline) { throw 'Manager did not confirm the update handoff.' }
    Start-Sleep -Milliseconds 100
  }
  Assert-UpdateService
  $stopped = $true
  Request-UpdateService 'Stop'
  Wait-UpdateService 'Stopped'
  Wait-UpdateManager
  # 只记录本次发行包新增的文件，回滚时不触碰用户原有文件或数据。
  $introducedFiles = @(Get-ChildItem -LiteralPath $source -Recurse -File -Force | ForEach-Object {
    $relative = $_.FullName.Substring($source.TrimEnd('\\').Length + 1)
    $destination = Join-Path $target $relative
    if (-not (Test-Path -LiteralPath $destination)) { $destination }
  })
  $copyStarted = $true
  Get-ChildItem -LiteralPath $source -Force | Copy-Item -Destination $target -Recurse -Force
  ${restart ? 'Request-UpdateService \'Start\'\n  Wait-UpdateService \'Running\'\n  Wait-UpdateReady' : ''}
  Write-UpdateJson $resultPath @{ status = 'success' }
  Write-UpdateJson (Join-Path $stage 'completed.json') @{ status = 'success' }
} catch {
  $failure = $_.Exception.Message
  $recoveryErrors = @()
  if ($copyStarted) {
    try {
      Request-UpdateService 'Stop'
      Wait-UpdateService 'Stopped'
      foreach ($file in $introducedFiles) {
        if (Test-Path -LiteralPath $file) { Remove-Item -LiteralPath $file -Force -ErrorAction Stop }
      }
      Get-ChildItem -LiteralPath $backup -Force | Copy-Item -Destination $target -Recurse -Force
    } catch { $recoveryErrors += $_.Exception.Message }
  }
  if ($stopped) {
    try {
      Request-UpdateService 'Start'
      Wait-UpdateService 'Running'
      Wait-UpdateReady
    } catch { $recoveryErrors += $_.Exception.Message }
  }
  Write-UpdateJson $resultPath @{ status = 'failed'; error = $failure; recoveryError = ($recoveryErrors -join '; ') }
  exit 1
} finally {
  # 只释放本任务持有的锁，避免交接失败后误删其他安装器的新锁。
  try {
    $lock = Get-Content -LiteralPath $lockPath -Raw -ErrorAction Stop | ConvertFrom-Json
    if ([int]$lock.pid -eq $PID) { Remove-Item -LiteralPath $lockPath -Force -ErrorAction Stop }
  } catch { }
  try { Remove-UpdateTask } catch {
    Write-UpdateJson (Join-Path $stage 'task-cleanup-error.json') @{ task = $taskName; error = $_.Exception.Message }
  }
}
`;
};

/** 注册失败或超时只清理本次任务；没有 activate 就不能停服。 */
export const launchWindowsServiceUpdater = async (
  stageRoot: string, scriptPath: string, taskName: string, run: RunPowerShell = runPowerShell
): Promise<{ pid: number, activate: () => void }> => {
  try {
    await run(renderTaskRegistration(taskName, scriptPath, path.resolve('.')));
    const deadline = Date.now() + 20_000;
    while (Date.now() < deadline) {
      const ready = path.join(stageRoot, 'ready.json');
      if (fs.existsSync(ready)) {
        try {
          const {
            pid
          } = JSON.parse(fs.readFileSync(ready, 'utf8')) as { pid: number };
          if (!Number.isSafeInteger(pid) || pid <= 0) {
            throw new Error('Invalid installer PID');
          }
          process.kill(pid, 0);
          return {
            pid,
            activate: () => fs.writeFileSync(path.join(stageRoot, 'handoff.json'), '{}')
          };
        } catch (error) {
          // 文件写入尚未完成时重试；其他错误由超时统一返回。
          if ((error as NodeJS.ErrnoException).code === 'EPERM') {
            throw new Error('Cannot verify the service update task; use AWA-Update.cmd', {
              cause: error
            });
          }
        }
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    throw new Error('Service update task did not become ready; use AWA-Update.cmd');
  } catch (error) {
    await run(`$taskName = ${psQuote(taskName)}\n${taskFunctions}\nRemove-UpdateTask`).catch(() => undefined);
    throw new Error('无法启动或确认服务更新任务，请运行安装目录中的 AWA-Update.cmd。', {
      cause: error
    });
  }
};
