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
import * as chalk from 'chalk';
import * as yamlLint from 'yaml-lint';
import * as i18n from 'i18n';
import { createServer } from './webUI/index';
import * as dayjs from 'dayjs';
// @ts-ignore
import CHANGELOG from './CHANGELOG.txt';
import { execSync } from 'child_process';
import * as os from 'os';

// @ts-ignore
import * as zh from './locales/zh.json';
// @ts-ignore
import * as en from './locales/en.json';

const startHelper = async () => {
  globalThis.log = true;
  process.on('SIGTERM', async () => {
    new Logger(time() + chalk.yellow(__('processWasKilled')));
    try {
      await push(`${__('pushTitle')}:\n${__('processWasKilled')}\n\n${pushQuestInfoFormat()}${globalThis.newVersionNotice}`);
    } catch (e) {
      await push(`${__('pushTitle')}:\n${__('processWasKilled')}${globalThis.newVersionNotice}`);
    }
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    new Logger(time() + chalk.yellow(__('processWasInterrupted')));
    try {
      await push(`${__('pushTitle')}:\n${__('processWasInterrupted')}\n\n${pushQuestInfoFormat()}${globalThis.newVersionNotice}`);
    } catch (e) {
      await push(`${__('pushTitle')}:\n${__('processWasInterrupted')}${globalThis.newVersionNotice}`);
    }
    process.exit(0);
  });

  process.on('uncaughtException', async (err) => {
    if (err.message.includes('EPIPE')) {
      globalThis.log = false;
      new Logger(time() + chalk.yellow(__('processError')));
      new Logger(`Uncaught Exception: ${err.message}\n${err.stack}`);
      process.kill(process.pid, 'SIGTERM');
      process.disconnect();
      return;
    }
    new Logger(time() + chalk.yellow(__('processError')));
    try {
      await push(`${__('pushTitle')}:\n${__('processError')}\n\n${pushQuestInfoFormat()}\n\n${__('errorMessage')}:\nUncaught Exception: ${err.message}${globalThis.newVersionNotice}`);
    } catch (e) {
      await push(`${__('pushTitle')}:\n${__('processError')}\n\n${__('errorMessage')}:\nUncaught Exception: ${err.message}${globalThis.newVersionNotice}`);
    }
    new Logger(`Uncaught Exception: ${err.message}\n${err.stack}`);
    process.exit(0);
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
  globalThis.ws = null;
  globalThis.webUI = true;
  // 检查是否已运行
  if (fs.existsSync('.lock')) {
    try {
      fs.unlinkSync('.lock');
    } catch (e) {
      new Logger(chalk.red(__('running')));
      new Logger(chalk.blue(__('multipleAccountAlert')));
      new Logger(__('exitAlert'));
      process.stdin.setRawMode(true);
      process.stdin.on('data', () => process.exit(0));
      return;
    }
  }
  const locked = await new Promise((resolve) => {
    fs.open('.lock', 'w', (error) => {
      if (error) {
        resolve(true);
      }
      if (os.type() === 'Windows_NT') {
        try {
          execSync('attrib +h .lock');
        } catch (e) {
          //
        }
      }
      resolve(false);
    });
  });
  if (locked) {
    new Logger(time() + chalk.red(__('running')));
    new Logger(time() + chalk.blue(__('multipleAccountAlert')));
    new Logger(__('exitAlert'));
    process.stdin.setRawMode(true);
    process.stdin.on('data', () => process.exit(0));
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
      } catch (e) {
        //
      }
    }
    fs.writeFileSync('.version', version);
    if (os.type() === 'Windows_NT') {
      try {
        execSync('attrib +h .version');
      } catch (e) {
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
    awaDailyQuestNumber1: true,
    asfProtocol: 'http'
  };
  // 读取配置文件
  const configString = fs.readFileSync(configPath).toString();
  let config: config | null = null;
  await yamlLint
    .lint(configString)
    .then(() => {
      config = { ...defaultConfig, ...parse(configString) };
    })
    .catch((error) => {
      new Logger(time() + chalk.red(__('configFileErrorAlter', error.mark?.line ? chalk.blue(error.mark?.line + 1) : '???', chalk.yellow(__('configFileErrorLocation')))));
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
    // awaBoosterNotice,
    awaQuests,
    awaDailyQuestType,
    awaDailyQuestNumber1,
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
    // awaSafeReply,
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
    const logFiles = fs.readdirSync('logs');
    if (logsExpire && logsExpire < logFiles.length) {
      const logger = new Logger(`${time()}${__('clearingLogs')}`, false);
      const now = dayjs();
      logFiles.forEach((filename) => {
        if (now.diff(filename.replace('.txt', ''), 'day') >= logsExpire) {
          fs.unlinkSync(path.join('logs', filename));
        }
      });
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
      new Logger(chalk.yellow(__('processTimeout')));
      await push(`${__('pushTitle')}:\n${__('processTimeout')}\n\n${pushQuestInfoFormat()}${globalThis.newVersionNotice}`);
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
    awaDailyQuestNumber1,
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
    } catch (e) {
      await push(`${__('pushTitle')}:\n${__('processInitError')}${globalThis.newVersionNotice}`);
    }
    process.exit(0);
  }
  fs.writeFileSync(configPath, configString.replace(awaCookie as string, awa.newCookie));
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

  const quests: Array<Promise<any>> = [];

  // AWA在线时长
  if (awaQuests.includes('timeOnSite') && awa.questInfo.timeOnSite?.addedArp !== awa.questInfo.timeOnSite?.maxArp) {
    quests.push(TimeOnSite.do());
  }
  await sleep(10);

  // Twitch直播心跳
  let twitch: TwitchTrack | null = null;
  if (awaQuests.includes('watchTwitch')) {
    await awa.getTwitchTech();
    if (awa.questInfo.watchTwitch?.[0] !== '15' || parseFloat(awa.questInfo.watchTwitch?.[1] || '0') < awa.additionalTwitchARP) {
      if (twitchCookie) {
        twitch = new TwitchTrack({ cookie: twitchCookie, proxy });
        if (await twitch.init() === true) {
          quests.push(twitch.do());
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
  let steamQuest: SteamQuestASF | null = null;
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
        steamQuest = new SteamQuestASF({
          asfProtocol,
          asfHost: asfHost as string,
          asfPort: asfPort as number,
          asfPassword,
          asfBotname: asfBotname as string,
          proxy
        });
        if (await steamQuest.init()) {
          quests.push(steamQuest.do());
          await sleep(30);
        }
      }
    }
  }

  awa.listen();
  await Promise.allSettled(quests);
  new Logger(time() + chalk.green(__('allTaskCompleted')));
  await push(`${__('pushTitle')}:\n${__('allTaskCompleted')}\n\n${pushQuestInfoFormat()}${globalThis.newVersionNotice}`);
  process.exit(0);
};

export { startHelper };
