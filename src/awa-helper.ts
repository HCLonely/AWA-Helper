/*
 * @Author       : HCLonely
 * @Date         : 2025-07-18 09:14:00
 * @LastEditTime : 2025-08-25 10:30:22
 * @LastEditors  : HCLonely
 * @FilePath     : /AWA-Helper/src/awa-helper.ts
 * @Description  : 启动助手
 */
/* global config, __ */
import { AWA } from './AWA';
import { DailyQuest } from './DailyQuest';
import { DailyQuestOld } from './DailyQuestOld';
import { TimeOnSite } from './TimeOnSite';
import { TwitchTrack } from './TwitchTrack';
import { SteamQuestASF } from './SteamQuestASF';
import * as fs from 'fs';
import * as path from 'path';
import { join, resolve } from 'path';
import { parse } from 'yaml';
import { sleep, Logger, time, checkUpdate, push, pushQuestInfoFormat } from './tool';
import chalk from 'chalk';
import * as yamlLint from 'yaml-lint';
import * as i18n from 'i18n';
import { createServer } from './webUI/index';
// @ts-ignore
import CHANGELOG from './CHANGELOG.txt';
import { execSync } from 'child_process';
import * as os from 'os';
import { ProcessLock } from './core/process/ProcessLock';
import { createConfigValidationError, updateYamlFieldsSync } from './core/config/yamlConfig';
import { deepMerge, validateHelperConfig } from './core/config/configSchema';
import { setLogSecrets } from './core/logging/sanitize';
import { cleanupExpiredLogs } from './core/logging/retention';

// @ts-ignore
import * as zh from './locales/zh.json';
// @ts-ignore
import * as en from './locales/en.json';

const startHelper = async () => {
  globalThis.log = true;
  const helperLock = new ProcessLock(path.join('data', 'helper.lock'));
  const shutdownController = new AbortController();
  let activeTaskCompletion: Promise<Array<PromiseSettledResult<unknown>>> = Promise.resolve([]);
  const waitForTaskCleanup = async (): Promise<void> => {
    await Promise.race([
      activeTaskCompletion,
      new Promise((resolve) => setTimeout(resolve, 15 * 1000))
    ]);
    await helperLock.release();
  };
  process.once('exit', () => helperLock.releaseSync());
  process.on('SIGTERM', async () => {
    shutdownController.abort(new Error('SIGTERM'));
    new Logger(time() + chalk.yellow(__('processWasKilled')));
    try {
      await push(`${__('pushTitle')}:\n${__('processWasKilled')}\n\n${pushQuestInfoFormat()}${globalThis.newVersionNotice}`);
    } catch (_e) {
      await push(`${__('pushTitle')}:\n${__('processWasKilled')}${globalThis.newVersionNotice}`);
    }
    await waitForTaskCleanup();
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    shutdownController.abort(new Error('SIGINT'));
    new Logger(time() + chalk.yellow(__('processWasInterrupted')));
    try {
      await push(`${__('pushTitle')}:\n${__('processWasInterrupted')}\n\n${pushQuestInfoFormat()}${globalThis.newVersionNotice}`);
    } catch (_e) {
      await push(`${__('pushTitle')}:\n${__('processWasInterrupted')}${globalThis.newVersionNotice}`);
    }
    await waitForTaskCleanup();
    process.exit(0);
  });

  process.on('uncaughtException', async (err) => {
    shutdownController.abort(err);
    if (err.message.includes('EPIPE')) {
      globalThis.log = false;
      new Logger(time() + chalk.yellow(__('processError')));
      new Logger(`Uncaught Exception: ${err.message}\n${err.stack}`);
      process.kill(process.pid, 'SIGTERM');
      process.disconnect?.();
      return;
    }
    new Logger(time() + chalk.yellow(__('processError')));
    try {
      await push(`${__('pushTitle')}:\n${__('processError')}\n\n${pushQuestInfoFormat()}\n\n${__('errorMessage')}:\nUncaught Exception: ${err.message}${globalThis.newVersionNotice}`);
    } catch (_e) {
      await push(`${__('pushTitle')}:\n${__('processError')}\n\n${__('errorMessage')}:\nUncaught Exception: ${err.message}${globalThis.newVersionNotice}`);
    }
    new Logger(`Uncaught Exception: ${err.message}\n${err.stack}`);
    await waitForTaskCleanup();
    process.exit(1);
  });

  // 国际化
  i18n.configure({
    locales: ['zh', 'en'],
    staticCatalog: {
      zh,
      en
    },
    defaultLocale: 'zh',
    register: globalThis
  });
  globalThis.wsClients = new Set();
  globalThis.webUI = true;
  // 检查是否已运行。使用排他创建确保多个进程不能同时获得锁。
  if (!await helperLock.acquire()) {
    new Logger(time() + chalk.red(__('running')));
    new Logger(time() + chalk.blue(__('multipleAccountAlert')));
    return;
  }
  // 打印版本信息
  const version = 'V__VERSION__ ';
  const logArr = '  ______   __       __   ______           __    __            __\n /      \\ /  |  _  /  | /      \\         /  |  /  |          /  |\n/$$$$$$  |$$ | / \\ $$ |/$$$$$$  |        $$ |  $$ |  ______  $$ |  ______    ______    ______\n$$ |__$$ |$$ |/$  \\$$ |$$ |__$$ | ______ $$ |__$$ | /      \\ $$ | /      \\  /      \\  /      \\\n$$    $$ |$$ /$$$  $$ |$$    $$ |/      |$$    $$ |/$$$$$$  |$$ |/$$$$$$  |/$$$$$$  |/$$$$$$  |\n$$$$$$$$ |$$ $$/$$ $$ |$$$$$$$$ |$$$$$$/ $$$$$$$$ |$$    $$ |$$ |$$ |  $$ |$$    $$ |$$ |  $$/\n$$ |  $$ |$$$$/  $$$$ |$$ |  $$ |        $$ |  $$ |$$$$$$$$/ $$ |$$ |__$$ |$$$$$$$$/ $$ |\n$$ |  $$ |$$$/    $$$ |$$ |  $$ |        $$ |  $$ |$$       |$$ |$$    $$/ $$       |$$ |\n$$/   $$/ $$/      $$/ $$/   $$/         $$/   $$/  $$$$$$$/ $$/ $$$$$$$/   $$$$$$$/ $$/\n                                                                 $$ |\n                                                                 $$ |\n                                                                 $$/               by HCLonely '.split('\n');
  logArr[logArr.length - 2] = `${logArr[logArr.length - 2]}              ${version}`;
  new Logger(logArr.join('\n'));
  new Logger(chalk.red.bold('\n* 重要提示：后台挂机可能导致COD封号，游玩COD时请关闭本程序！！！\n\n* Important: Running this program at the same time as COD may result in a COD account ban. Please close this program when playing COD !!!\n'));

  // 获取配置文件路径
  let configPath = 'config.yml';
  if (/dist$/.test(process.cwd()) || /output$/.test(process.cwd())) {
    if (!fs.existsSync(configPath) && fs.existsSync(join('../', configPath))) {
      configPath = join('../', configPath);
    }
  }
  if (!fs.existsSync(configPath)) {
    configPath = 'config/config.yml';
    if (/dist$/.test(process.cwd()) || /output$/.test(process.cwd())) {
      if (!fs.existsSync(configPath) && fs.existsSync(join('../', configPath))) {
        configPath = join('../', configPath);
      }
    }
  }
  if (!fs.existsSync(configPath)) {
    new Logger(chalk.red(`${__('configFileNotFound')}[${chalk.yellow(resolve(configPath))}]!`));
    return;
  }

  // 打印更新信息
  if (!fs.existsSync('.version') || fs.readFileSync('.version').toString() !== version) {
    new Logger(chalk.green(__('updateContent')));
    console.table(CHANGELOG.trim()
      .split('\n')
      .map((e: string) => e.trim().replace('- ', '')));
    if (os.type() === 'Windows_NT') {
      try {
        execSync('attrib -h .version');
      } catch (_e) {
        //
      }
    }
    fs.writeFileSync('.version', version);
    if (os.type() === 'Windows_NT') {
      try {
        execSync('attrib +h .version');
      } catch (_e) {
        //
      }
    }
  }

  globalThis.version = version.replace('V', 'v');
  globalThis.userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/103.0.5060.134 Safari/537.36 Edg/103.0.1264.77';

  // 默认配置
  const defaultConfig: config = {
    language: 'zh',
    timeout: 86400,
    logsExpire: 30,
    webUI: {
      enable: false,
      port: 3456,
      local: true,
      reverseProxyPort: 0
    },
    awaHost: 'www.alienwarearena.com',
    awaBoosterNotice: true,
    awaQuests: ['getStarted', 'dailyQuest', 'timeOnSite', 'watchTwitch', 'steamQuest'],
    awaDailyQuestType: [
      'click',
      'visitLink',
      'openLink',
      'changeBorder',
      'changeAvatar',
      'viewNews'
    ],
    asfProtocol: 'http'
  };
  // 读取配置文件
  const configString = fs.readFileSync(configPath).toString();
  let config: config | null = null;
  await yamlLint
    .lint(configString)
    .then(() => {
      const parsedConfig = deepMerge(defaultConfig, parse(configString));
      const validationErrors = validateHelperConfig(parsedConfig);
      if (validationErrors.length > 0) {
        throw createConfigValidationError(configString, validationErrors);
      }
      config = parsedConfig;
      setLogSecrets(parsedConfig);
    })
    .catch((error) => {
      const errorLine = Number.isInteger(error.mark?.line) ? chalk.blue(error.mark.line + 1) : '???';
      new Logger(time() + chalk.red(__('configFileErrorAlter', errorLine, chalk.yellow(__('configFileErrorLocation')))));
      new Logger(error.message);
    });
  if (!config) {
    return;
  }
  const {
    language,
    timeout,
    logsExpire,
    autoUpdate,
    awaCookie,
    awaHost,
    awaQuests,
    awaDailyQuestType,
    twitchCookie,
    steamUse,
    asfProtocol,
    asfHost,
    asfPort,
    asfPassword,
    asfBotname,
    proxy,
    webUI,
    pusher,
    joinSteamCommunityEvent,
    TLSRejectUnauthorized,
    managerServer
  }: config = config;
  if (TLSRejectUnauthorized === false) {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
  }
  globalThis.webUI = !!webUI?.enable;
  globalThis.language = language || 'zh';
  globalThis.pusher = pusher;
  globalThis.awaHost = awaHost || 'www.alienwarearena.com';
  i18n.setLocale(language);

  // 清理日志
  if (fs.existsSync('logs')) {
    if (logsExpire) {
      const logger = new Logger(`${time()}${__('clearingLogs')}`, false);
      cleanupExpiredLogs('logs', logsExpire);
      logger.log(chalk.green('OK'));
    }
  }
  // 设置推送代理
  if (pusher?.enable && proxy?.enable?.includes('pusher')) {
    globalThis.pusherProxy = proxy;
  }

  // 设置超时
  if (timeout && typeof timeout === 'number' && timeout > 0) {
    setTimeout(async () => {
      shutdownController.abort(new Error('Process timeout'));
      new Logger(chalk.yellow(__('processTimeout')));
      await push(`${__('pushTitle')}:\n${__('processTimeout')}\n\n${pushQuestInfoFormat()}${globalThis.newVersionNotice}`);
      await waitForTaskCleanup();
      process.exit(0);
    }, timeout * 1000);
  }

  // 启动WebUI
  if (webUI?.enable) {
    const port = webUI.port || 3456;
    let options: undefined | {
      key: Buffer,
      cert: Buffer
    } = undefined;
    if (webUI.ssl?.key && webUI.ssl.cert) {
      const keyPath = path.join(path.dirname(configPath), webUI.ssl.key);
      const certPath = path.join(path.dirname(configPath), webUI.ssl.cert);
      if (!fs.existsSync(keyPath)) {
        new Logger(time() + chalk.yellow(__('missingSSLKey')));
        return;
      }
      if (!fs.existsSync(certPath)) {
        new Logger(time() + chalk.yellow(__('missingSSLCert')));
        return;
      }
      options = {
        key: fs.readFileSync(keyPath),
        cert: fs.readFileSync(certPath)
      };
    }
    const server = createServer(options);

    server.listen(port, (webUI.reverseProxyPort || webUI.local) ? '127.0.0.1' : '0.0.0.0',  () => {
      new Logger(time() + __('webUIStart', chalk.yellow(`${webUI.ssl ? 'https' : 'http'}://localhost:${port}`)));
    });
  }

  // 检查AWA参数
  const missingAwaParams = Object.entries({
    awaCookie
  }).filter(([name, value]) => name !== 'proxy' && !value).map(([name]) => name);
  if (missingAwaParams.length > 0) {
    new Logger(chalk.red(__('missingAwaParams')));
    new Logger(missingAwaParams);
    return;
  }

  // 检查更新
  globalThis.newVersionNotice = '';
  await checkUpdate(version, managerServer, !!autoUpdate || process.argv.includes('--update'), CHANGELOG, proxy);
  if (process.argv.includes('--update')) {
    process.exit(0);
    return;
  }

  // 初始化AWA
  const awa = new AWA({
    awaCookie: awaCookie as string,
    proxy,
    joinSteamCommunityEvent,
    // awaDailyQuestNumber1,
    getStarted: awaQuests.includes('getStarted')
  });

  const initResult = await awa.init();
  if (initResult !== 200) {
    const errorMap = {
      0: __('netError'),
      602: __('tokenExpired'),
      603: __('noBorderAndBadges'),
      604: __('noBorder'),
      605: __('noBadges'),
      610: __('ipBanned')
    };
    const initError = errorMap[initResult as keyof typeof errorMap] || __('unknownError');
    try {
      await push(`${__('pushTitle')}:\n${__('processInitError')}\n\n${initError}, ${__('checkLog')}${globalThis.newVersionNotice}`);
    } catch (_e) {
      await push(`${__('pushTitle')}:\n${__('processInitError')}${globalThis.newVersionNotice}`);
    }
    process.exit(0);
  }
  updateYamlFieldsSync(configPath, { awaCookie: awa.newCookie });
  globalThis.quest = awa;

  // 每日任务
  if (awaQuests.includes('dailyQuest') && (awa.questInfo.dailyQuest || []).filter((e: { status: string; }) => e.status === 'complete').length !== (awa.questInfo.dailyQuest || []).length) {
    const dailyQuest = new DailyQuest();
    await dailyQuest.do();
  }
  // 每日任务(旧版)
  if (awaQuests.includes('dailyQuestOld') && (awa.questInfo.dailyQuest || []).filter((e: { status: string; }) => e.status === 'complete').length !== (awa.questInfo.dailyQuest || []).length) {
    const dailyQuestOld = new DailyQuestOld({
      awaDailyQuestType
    });
    await dailyQuestOld.do();
  }

  const quests: Array<{ name: string, promise: Promise<unknown> }> = [];

  // AWA在线时长
  if (awaQuests.includes('timeOnSite') && awa.questInfo.timeOnSite?.addedArp !== awa.questInfo.timeOnSite?.maxArp) {
    quests.push({ name: 'AWA TimeOnSite', promise: TimeOnSite.do(shutdownController.signal) });
  }
  await sleep(10);

  // Twitch直播心跳
  // let twitch: TwitchTrack | null = null;
  if (awaQuests.includes('watchTwitch')) {
    await awa.getTwitchTech();
    if (awa.questInfo.watchTwitch?.[0] !== '15' || parseFloat(awa.questInfo.watchTwitch?.[1] || '0') < awa.additionalTwitchARP) {
      if (twitchCookie) {
        const twitch = new TwitchTrack({ cookie: twitchCookie, proxy });
        if (await twitch.init() === true) {
          quests.push({ name: 'Twitch', promise: twitch.do(shutdownController.signal) });
          await sleep(10);
        }
      } else {
        new Logger(time() + chalk.yellow(__('missingTwitchParams', chalk.blue('["twitchCookie"]'))));
      }
    } else {
      new Logger(time() + chalk.green(__('twitchTaskCompleted')));
    }
  }

  // Steam任务
  // let steamQuest: SteamQuestASF | null = null;
  if (!steamUse || steamUse === 'ASF') {
    const missingAsfParams = Object.entries({
      asfProtocol,
      asfHost,
      asfPort,
      asfBotname
    }).filter(([name, value]) => name !== 'proxy' && !value).map(([name]) => name);
    if (awaQuests.includes('steamQuest')) {
      if (missingAsfParams.length > 0) {
        new Logger(time() + chalk.yellow(__('missingSteamParams', chalk.blue(JSON.stringify(missingAsfParams)))));
      } else {
        const steamQuest = new SteamQuestASF({
          asfProtocol,
          asfHost: asfHost as string,
          asfPort: asfPort as number,
          asfPassword,
          asfBotname: asfBotname as string,
          proxy
        });
        if (await steamQuest.init()) {
          quests.push({ name: 'Steam ASF', promise: steamQuest.do(shutdownController.signal) });
          await sleep(30);
        }
      }
    }
  }

  void awa.listen(shutdownController.signal).catch((error) => {
    new Logger(`${time()}AWA listener failed: ${error instanceof Error ? error.message : String(error)}`);
  });
  activeTaskCompletion = Promise.allSettled(quests.map(({ promise }) => promise));
  const questResults = await activeTaskCompletion;
  const failedQuests = questResults.flatMap((result, index) => {
    if (result.status === 'rejected' || result.value === false) {
      return [quests[index]?.name || `Task ${index + 1}`];
    }
    return [];
  });
  if (failedQuests.length > 0) {
    const errorMessage = `${__('processError')}: ${failedQuests.join(', ')}`;
    new Logger(time() + chalk.red(errorMessage));
    await push(`${__('pushTitle')}:\n${errorMessage}\n\n${pushQuestInfoFormat()}${globalThis.newVersionNotice}`);
    process.exit(1);
  }
  new Logger(time() + chalk.green(__('allTaskCompleted')));
  await push(`${__('pushTitle')}:\n${__('allTaskCompleted')}\n\n${pushQuestInfoFormat()}${globalThis.newVersionNotice}`);
  process.exit(0);
};

export { startHelper };
