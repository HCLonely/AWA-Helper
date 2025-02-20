/*
 * @Author       : HCLonely
 * @Date         : 2024-02-24 15:32:30
 * @LastEditTime : 2024-08-20 15:16:42
 * @LastEditors  : HCLonely
 * @FilePath     : /AWA-Helper/src/awa-helper.ts
 */
/* eslint-disable max-len */
/* global config, __ */
import { DailyQuest } from './DailyQuest';
import { TwitchTrack } from './TwitchTrack';
import { SteamQuestASF } from './SteamQuestASF';
// import { SteamQuestSU } from './SteamQuestSU';
import * as fs from 'fs';
import * as path from 'path';
import { join, resolve } from 'path';
import { EventEmitter } from 'events';
const emitter = new EventEmitter();
import { parse } from 'yaml';
import { sleep, Logger, time, checkUpdate, push, pushQuestInfoFormat } from './tool';
import * as chalk from 'chalk';
import * as yamlLint from 'yaml-lint';
import * as i18n from 'i18n';
import { createServer } from './webUI/index';
import * as dayjs from 'dayjs';
// @ts-ignore
import CHANGELOG from '../CHANGELOG.txt';
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
      await push(`${__('pushTitle')}\n${__('processWasKilled')}\n\n${pushQuestInfoFormat()}${globalThis.newVersionNotice}`);
    } catch (e) {
      await push(`${__('pushTitle')}\n${__('processWasKilled')}${globalThis.newVersionNotice}`);
    }
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    new Logger(time() + chalk.yellow(__('processWasInterrupted')));
    try {
      await push(`${__('pushTitle')}\n${__('processWasInterrupted')}\n\n${pushQuestInfoFormat()}${globalThis.newVersionNotice}`);
    } catch (e) {
      await push(`${__('pushTitle')}\n${__('processWasInterrupted')}${globalThis.newVersionNotice}`);
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
      await push(`${__('pushTitle')}\n${__('processError')}\n\n${pushQuestInfoFormat()}\n\n${__('errorMessage')}:\nUncaught Exception: ${err.message}${globalThis.newVersionNotice}`);
    } catch (e) {
      await push(`${__('pushTitle')}\n${__('processError')}\n\n${__('errorMessage')}:\nUncaught Exception: ${err.message}${globalThis.newVersionNotice}`);
    }
    new Logger(`Uncaught Exception: ${err.message}\n${err.stack}`);
    process.exit(0);
  });

  i18n.configure({
    locales: ['zh', 'en'],
    // directory: path.join(process.cwd(), '/locales'),
    // extension: '.json',
    staticCatalog: {
      zh,
      en
    },
    defaultLocale: 'zh',
    register: globalThis
  });
  globalThis.ws = null;
  globalThis.webUI = true;
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
  const version = 'V__VERSION__ ';
  const logArr = '  ______   __       __   ______           __    __            __\n /      \\ /  |  _  /  | /      \\         /  |  /  |          /  |\n/$$$$$$  |$$ | / \\ $$ |/$$$$$$  |        $$ |  $$ |  ______  $$ |  ______    ______    ______\n$$ |__$$ |$$ |/$  \\$$ |$$ |__$$ | ______ $$ |__$$ | /      \\ $$ | /      \\  /      \\  /      \\\n$$    $$ |$$ /$$$  $$ |$$    $$ |/      |$$    $$ |/$$$$$$  |$$ |/$$$$$$  |/$$$$$$  |/$$$$$$  |\n$$$$$$$$ |$$ $$/$$ $$ |$$$$$$$$ |$$$$$$/ $$$$$$$$ |$$    $$ |$$ |$$ |  $$ |$$    $$ |$$ |  $$/\n$$ |  $$ |$$$$/  $$$$ |$$ |  $$ |        $$ |  $$ |$$$$$$$$/ $$ |$$ |__$$ |$$$$$$$$/ $$ |\n$$ |  $$ |$$$/    $$$ |$$ |  $$ |        $$ |  $$ |$$       |$$ |$$    $$/ $$       |$$ |\n$$/   $$/ $$/      $$/ $$/   $$/         $$/   $$/  $$$$$$$/ $$/ $$$$$$$/   $$$$$$$/ $$/\n                                                                 $$ |\n                                                                 $$ |\n                                                                 $$/               by HCLonely '.split('\n');
  logArr[logArr.length - 2] = `${logArr[logArr.length - 2]}              ${version}`;
  new Logger(logArr.join('\n'));
  new Logger(chalk.red.bold('\n* 重要提示：后台挂机可能导致COD封号，游玩COD时请关闭本程序！！！\n\n* Important: Running this program at the same time as COD may result in a COD account ban. Please close this program when playing COD !!!\n'));

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
      'changeBadge',
      'changeAvatar',
      'viewPost',
      'viewNew',
      'sharePost',
      'replyPost'
    ],
    awaDailyQuestNumber1: true,
    asfProtocol: 'http'
  };
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
    awaBoosterNotice,
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
    awaSafeReply,
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
  if (pusher?.enable && proxy?.enable?.includes('pusher')) {
    globalThis.pusherProxy = proxy;
  }

  if (timeout && typeof timeout === 'number' && timeout > 0) {
    setTimeout(async () => {
      new Logger(chalk.yellow(__('processTimeout')));
      await push(`${__('pushTitle')}\n${__('processTimeout')}\n\n${pushQuestInfoFormat()}${globalThis.newVersionNotice}`);
      process.exit(0);
    }, timeout * 1000);
  }

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

  const missingAwaParams = Object.entries({
    awaCookie
  }).filter(([name, value]) => name !== 'proxy' && !value).map(([name]) => name);
  if (missingAwaParams.length > 0) {
    new Logger(chalk.red(__('missingAwaParams')));
    new Logger(missingAwaParams);
    return;
  }

  globalThis.newVersionNotice = '';
  await checkUpdate(version, managerServer, !!autoUpdate || process.argv.includes('--update'), CHANGELOG, proxy);
  if (process.argv.includes('--update')) {
    process.exit(0);
    return;
  }

  const quest = new DailyQuest({
    awaCookie: awaCookie as string,
    awaBoosterNotice: awaBoosterNotice as boolean,
    awaDailyQuestType,
    awaDailyQuestNumber1,
    proxy,
    awaSafeReply,
    joinSteamCommunityEvent,
    getStarted: awaQuests.includes('getStarted'),
    tasksFinished: new Map([
      ['dailyQuest', !awaQuests.includes('dailyQuest')],
      ['timeOnSite', !awaQuests.includes('timeOnSite')],
      ['steam', !awaQuests.includes('steamQuest')],
      ['twitch', !awaQuests.includes('watchTwitch')]
    ])
  });
  const initResult = await quest.init();
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
      await push(`${__('pushTitle')}\n${__('processInitError')}\n\n${initError}, ${__('checkLog')}${globalThis.newVersionNotice}`);
    } catch (e) {
      await push(`${__('pushTitle')}\n${__('processInitError')}${globalThis.newVersionNotice}`);
    }
    process.exit(0);
  }
  fs.writeFileSync(configPath, configString.replace(awaCookie as string, quest.newCookie));
  await quest.listen(true);
  globalThis.quest = quest;

  if (awaQuests.includes('dailyQuest') && (quest.questInfo.dailyQuest || []).filter((e) => e.status === 'complete').length !== quest.questInfo.dailyQuest?.length) {
    await quest.do();
  } else {
    emitter.emit('taskComplete', 'dailyQuest');
  }
  if (awaQuests.includes('timeOnSite') && quest.questInfo.timeOnSite?.addedArp !== quest.questInfo.timeOnSite?.maxArp) {
    quest.track();
  } else {
    emitter.emit('taskComplete', 'timeOnSite');
  }
  await sleep(10);

  let twitch: TwitchTrack | null = null;
  if (awaQuests.includes('watchTwitch')) {
    await quest.getTwitchTech();
    if (quest.questInfo.watchTwitch?.[0] !== '15' || parseFloat(quest.questInfo.watchTwitch?.[1] || '0') < quest.additionalTwitchARP) {
      if (twitchCookie) {
        twitch = new TwitchTrack({ cookie: twitchCookie, awaHeaders: quest.headers, proxy });
        emitter.on('taskComplete', async (data) => {
          if (data === 'twitch') {
            twitch = null;
          }
        });
        if (await twitch.init() === true) {
          twitch.sendTrack();
          await sleep(10);
        } else {
          emitter.emit('taskCompleted', 'twitch');
        }
      } else {
        emitter.emit('taskCompleted', 'twitch');
        new Logger(time() + chalk.yellow(__('missingTwitchParams', chalk.blue('["twitchCookie"]'))));
      }
    } else {
      emitter.emit('taskCompleted', 'twitch');
      new Logger(time() + chalk.green(__('twitchTaskCompleted')));
    }
  }

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
        emitter.emit('taskComplete', 'steam');
        new Logger(time() + chalk.yellow(__('missingSteamParams', chalk.blue(JSON.stringify(missingAsfParams)))));
      } else {
        steamQuest = new SteamQuestASF({
          awaCookie: quest.newCookie,
          asfProtocol,
          asfHost: asfHost as string,
          asfPort: asfPort as number,
          asfPassword,
          asfBotname: asfBotname as string,
          proxy
        });
        emitter.on('taskComplete', async (data) => {
          if (data === 'steam') {
            steamQuest = null;
          }
        });
        if (await steamQuest.init()) {
          steamQuest.playGames();
          await sleep(30);
        } else {
          emitter.emit('taskComplete', 'steam');
        }
      }
    } else {
      emitter.emit('taskComplete', 'steam');
    }
  }

  quest.listen();
};

export { startHelper };
