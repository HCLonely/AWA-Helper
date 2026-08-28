/**
 * @file src/index.ts
 * @description 解析命令行选项，创建运行时文件，并启动统一的 Manager 应用运行时。
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { formatHelp, parseArguments } from './cli';
import { ManagerRuntime } from './core/Manager';
import { ProcessLock } from './tools/process/ProcessLock';
import { runHealthcheck } from './tools/process/healthcheck';
import { TrayBridge } from './tools/process/TrayBridge';
import { loadConfig } from './tools/config';
import { scheduleUpdate, UpdateInstallerError } from './tools/update';
import { initializeI18n } from './tools/i18n';
import { Logger } from './tools/logging';
// @ts-ignore 在构建期间由 YAML 生成。
import * as zh from './locales/zh.json';
// @ts-ignore 在构建期间由 YAML 生成。
import * as en from './locales/en.json';
// @ts-ignore 由 Rollup 以字符串形式打包。
import exampleConfig from './config.example.yml';

process.chdir(__dirname);

const version = 'v__VERSION__';
let activeTrayBridge: TrayBridge | undefined;

/**
 * 创建 create Runtime Files 相关数据。
 * @returns `void`，该函数仅执行副作用，不返回值。
 */
const createRuntimeFiles = (): void => {
  fs.mkdirSync('logs', { recursive: true });
  fs.mkdirSync('data', { recursive: true });
  fs.mkdirSync('config', { recursive: true });
  if (!fs.existsSync('config/config.example.yml')) {
    fs.writeFileSync('config/config.example.yml', exampleConfig);
  }
  const isMainJs = /main\.js$|index\.js$/.test(process.argv[1]);
  if (os.type() === 'Windows_NT') {
    if (!fs.existsSync('AWA-Manager.bat')) {
      fs.writeFileSync('AWA-Manager.bat', isMainJs ? 'cd "%~dp0" && start cmd /k "node index.js --manager"' : 'cd "%~dp0" && start cmd /k "AWA-Helper.exe --manager"');
    }
    if (!fs.existsSync('AWA-DailyQuest.bat')) {
      fs.writeFileSync('AWA-DailyQuest.bat', isMainJs ? 'cd "%~dp0" && start cmd /k "node index.js --daily"' : 'cd "%~dp0" && start cmd /k "AWA-Helper.exe --daily"');
    }
  } else {
    const manager = isMainJs ? '#!/bin/sh\ncd "$(dirname "$0")"\nnode index.js --manager\n' : '#!/bin/sh\ncd "$(dirname "$0")"\n./AWA-Helper --manager\n';
    const daily = isMainJs ? '#!/bin/sh\ncd "$(dirname "$0")"\nnode index.js --daily\n' : '#!/bin/sh\ncd "$(dirname "$0")"\n./AWA-Helper --daily\n';
    if (!fs.existsSync('AWA-Manager.sh')) {
      fs.writeFileSync('AWA-Manager.sh', manager, { mode: 0o755 });
    }
    if (!fs.existsSync('AWA-DailyQuest.sh')) {
      fs.writeFileSync('AWA-DailyQuest.sh', daily, { mode: 0o755 });
    }
  }
};

/**
 * 处理 main 相关逻辑。
 * @returns `Promise<number>`，main 计算或读取到的数值。
 */
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
  if (command.kind === 'init') {
    return 0;
  }
  if (command.kind === 'healthcheck') {
    return await runHealthcheck() ? 0 : 1;
  }
  if (command.kind === 'update') {
    const updateConfig = (() => {
      try {
        const { proxy, language } = loadConfig().raw;
        return { proxy, language };
      } catch (error) {
        if (!(error instanceof Error)) {
          throw error;
        }
        const { message } = error;
        if (!message.startsWith('Configuration file not found:')) {
          throw error;
        }
        return { proxy: undefined, language: 'zh' };
      }
    })();
    const { proxy: updateProxy, language: updateLanguage } = updateConfig;
    initializeI18n(updateLanguage, { zh, en });
    try {
      const update = await scheduleUpdate({ currentVersion: version, proxy: updateProxy, restart: false });
      console.log(__('updatePrepared', `V${update.version}`));
      return 0;
    } catch (error) {
      if (error instanceof UpdateInstallerError && error.code === 'UP_TO_DATE') {
        console.log(__('noUpdate'));
        return 0;
      }
      throw error;
    }
  }

  const { mode } = command;
  if (command.kind === 'run' && command.deprecatedHelper) {
    console.warn('[deprecated] --helper is retained for compatibility; use --daily instead.');
  }
  const lock = process.env.AWA_HELPER_CONTAINER === 'true'
    ? undefined
    : new ProcessLock(path.join('data', 'manager.lock'));
  if (lock && !await lock.acquire()) {
    throw new Error('Manager is already running');
  }
  if (lock) {
    process.once('exit', () => lock.releaseSync());
  }
  const runtime = new ManagerRuntime(mode, version, {
    onReady: (url) => activeTrayBridge?.ready(url),
    onStateChange: (states) => activeTrayBridge?.status(states)
  });
  /**
   * 停止 stop 相关数据。
   * @returns `void`，该函数仅执行副作用，不返回值。
   */
  const stop = (): void => runtime.requestShutdown();
  if (command.kind === 'run' && command.trayChild) {
    activeTrayBridge = new TrayBridge({
      shutdown: stop,
      startHelper: () => {
        void runtime.startJob('dailyQuest');
      },
      stopHelper: () => {
        void runtime.stopJob('dailyQuest');
      },
      startAchievement: () => {
        void runtime.startJob('achievement');
      },
      stopAchievement: () => {
        void runtime.stopJob('achievement');
      }
    });
  }
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
  try {
    return await runtime.run();
  } finally {
    process.removeListener('SIGINT', stop);
    process.removeListener('SIGTERM', stop);
    await runtime.stop();
    activeTrayBridge?.close();
    activeTrayBridge = undefined;
    await lock?.release();
  }
};

void main()
  .then((exitCode) => {
    process.exitCode = exitCode;
  })
  .catch((error) => {
    activeTrayBridge?.error();
    activeTrayBridge?.close();
    activeTrayBridge = undefined;
    new Logger(error);
    process.exitCode = 1;
  });
