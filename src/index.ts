/**
 * @file application entry
 * @description Parses CLI commands and starts the single Manager-owned application runtime.
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { formatHelp, parseArguments } from './cli';
import { ManagerRuntime } from './core/Manager';
import { ProcessLock } from './tools/process/ProcessLock';
import { runHealthcheck } from './tools/process/healthcheck';
// @ts-ignore bundled as a string by Rollup.
import exampleConfig from './config.example.yml';

process.chdir(__dirname);

const version = 'v__VERSION__';

const createRuntimeFiles = (): void => {
  fs.mkdirSync('logs', { recursive: true });
  fs.mkdirSync('data', { recursive: true });
  fs.mkdirSync('config', { recursive: true });
  if (!fs.existsSync('config/config.example.yml')) fs.writeFileSync('config/config.example.yml', exampleConfig);
  const isMainJs = /main\.js$|index\.js$/.test(process.argv[1]);
  if (os.type() === 'Windows_NT') {
    if (!fs.existsSync('AWA-Manager.bat')) fs.writeFileSync('AWA-Manager.bat', isMainJs ? 'cd "%~dp0" && start cmd /k "node index.js --manager"' : 'cd "%~dp0" && start cmd /k "AWA-Helper.exe --manager"');
    if (!fs.existsSync('AWA-DailyQuest.bat')) fs.writeFileSync('AWA-DailyQuest.bat', isMainJs ? 'cd "%~dp0" && start cmd /k "node index.js --daily"' : 'cd "%~dp0" && start cmd /k "AWA-Helper.exe --daily"');
  } else {
    const manager = isMainJs ? '#!/bin/sh\ncd "$(dirname "$0")"\nnode index.js --manager\n' : '#!/bin/sh\ncd "$(dirname "$0")"\n./AWA-Helper --manager\n';
    const daily = isMainJs ? '#!/bin/sh\ncd "$(dirname "$0")"\nnode index.js --daily\n' : '#!/bin/sh\ncd "$(dirname "$0")"\n./AWA-Helper --daily\n';
    if (!fs.existsSync('AWA-Manager.sh')) fs.writeFileSync('AWA-Manager.sh', manager, { mode: 0o755 });
    if (!fs.existsSync('AWA-DailyQuest.sh')) fs.writeFileSync('AWA-DailyQuest.sh', daily, { mode: 0o755 });
  }
};

const main = async (): Promise<number> => {
  const command = parseArguments(process.argv.slice(2));
  if (command.kind === 'help') {
    console.log(formatHelp());
    return 0;
  }
  if (command.kind === 'version') {
    console.log(version);
    return 0;
  }
  createRuntimeFiles();
  if (command.kind === 'init') return 0;
  if (command.kind === 'healthcheck') return await runHealthcheck() ? 0 : 1;

  const mode = command.kind === 'run' ? command.mode : 'once';
  if (command.kind === 'run' && command.deprecatedHelper) {
    console.warn('[deprecated] --helper is retained for compatibility; use --daily instead.');
  }
  const lock = new ProcessLock(path.join('data', 'manager.lock'));
  if (!await lock.acquire()) throw new Error('Manager is already running');
  process.once('exit', () => lock.releaseSync());
  const runtime = new ManagerRuntime(mode, version);
  const stop = (): void => runtime.requestShutdown();
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
  try {
    return await runtime.run();
  } finally {
    process.removeListener('SIGINT', stop);
    process.removeListener('SIGTERM', stop);
    await runtime.stop();
    await lock.release();
  }
};

void main()
  .then((exitCode) => { process.exitCode = exitCode; })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
