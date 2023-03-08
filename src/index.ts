/* eslint-disable max-len */
/* global config, __ */
import { DailyQuest } from './DailyQuest';
import { TwitchTrack } from './TwitchTrack';
import { SteamQuestASF } from './SteamQuestASF';
import { SteamQuestSU } from './SteamQuestSU';
import * as fs from 'fs';
import * as path from 'path';
import { join, resolve } from 'path';
import { parse } from 'yaml';
import { sleep, Logger, time, checkUpdate, push } from './tool';
import * as chalk from 'chalk';
import * as yamlLint from 'yaml-lint';
import * as i18n from 'i18n';
import { createServer } from './webUI/index';

process.on('SIGTERM', async () => {
  new Logger(time() + chalk.yellow(__('processWasKilled')));
  try {
    await push(`${__('pushTitle')}\n${__('processWasKilled')}${globalThis.quest?.formatQuestInfo ? `\n\n${Object.entries(globalThis.quest.formatQuestInfo()).map(([name, value]) => (name === __('steamCommunityEvent') ? `${name}:  ${value[__('obtainedARP')]}/${value[__('maxAvailableARP')]}` : `${name}:  ${value[__('obtainedARP')]} ARP`)).join('\n')}` : ''}`);
  } catch (e) {
    await push(`${__('pushTitle')}\n${__('processWasKilled')}`);
  }
  process.exit(0);
});

process.on('SIGINT', async () => {
  new Logger(time() + chalk.yellow(__('processWasInterrupted')));
  try {
    await push(`${__('pushTitle')}\n${__('processWasInterrupted')}${globalThis.quest?.formatQuestInfo ? `\n\n${Object.entries(globalThis.quest.formatQuestInfo()).map(([name, value]) => (name === __('steamCommunityEvent') ? `${name}:  ${value[__('obtainedARP')]}/${value[__('maxAvailableARP')]}` : `${name}:  ${value[__('obtainedARP')]} ARP`)).join('\n')}` : ''}`);
  } catch (e) {
    await push(`${__('pushTitle')}\n${__('processWasInterrupted')}`);
  }
  process.exit(0);
});

process.on('uncaughtException', async (err) => {
  new Logger(time() + chalk.yellow(__('processError')));
  try {
    await push(`${__('pushTitle')}\n${__('processError')}${globalThis.quest?.formatQuestInfo ? `\n\n${Object.entries(globalThis.quest.formatQuestInfo()).map(([name, value]) => (name === __('steamCommunityEvent') ? `${name}:  ${value[__('obtainedARP')]}/${value[__('maxAvailableARP')]}` : `${name}:  ${value[__('obtainedARP')]} ARP`)).join('\n')}` : ''}\n\n${__('errorMessage')}: \nUncaught Exception: ${err.message}`);
  } catch (e) {
    await push(`${__('pushTitle')}\n${__('processError')}\n\n${__('errorMessage')}: \nUncaught Exception: ${err.message}`);
  }
  new Logger(`Uncaught Exception: ${err.message}`);
  process.exit(1);
});

(async () => {
  i18n.configure({
    locales: ['zh', 'en'],
    directory: path.join(process.cwd(), '/locales'),
    extension: '.json',
    defaultLocale: 'zh',
    register: globalThis
  });
  globalThis.ws = null;
  globalThis.webUI = true;
  if (fs.existsSync('lock')) {
    try {
      fs.unlinkSync('lock');
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
    fs.open('lock', 'w', (error) => {
      if (error) {
        resolve(true);
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
  const logArr = '  ______   __       __   ______           __    __            __                               \n /      \\ /  |  _  /  | /      \\         /  |  /  |          /  |                              \n/$$$$$$  |$$ | / \\ $$ |/$$$$$$  |        $$ |  $$ |  ______  $$ |  ______    ______    ______  \n$$ |__$$ |$$ |/$  \\$$ |$$ |__$$ | ______ $$ |__$$ | /      \\ $$ | /      \\  /      \\  /      \\ \n$$    $$ |$$ /$$$  $$ |$$    $$ |/      |$$    $$ |/$$$$$$  |$$ |/$$$$$$  |/$$$$$$  |/$$$$$$  |\n$$$$$$$$ |$$ $$/$$ $$ |$$$$$$$$ |$$$$$$/ $$$$$$$$ |$$    $$ |$$ |$$ |  $$ |$$    $$ |$$ |  $$/ \n$$ |  $$ |$$$$/  $$$$ |$$ |  $$ |        $$ |  $$ |$$$$$$$$/ $$ |$$ |__$$ |$$$$$$$$/ $$ |      \n$$ |  $$ |$$$/    $$$ |$$ |  $$ |        $$ |  $$ |$$       |$$ |$$    $$/ $$       |$$ |      \n$$/   $$/ $$/      $$/ $$/   $$/         $$/   $$/  $$$$$$$/ $$/ $$$$$$$/   $$$$$$$/ $$/       \n                                                                 $$ |                          \n                                                                 $$ |                          \n                                                                 $$/               by HCLonely '.split('\n');
  logArr[logArr.length - 2] = logArr[logArr.length - 2].replace(new RegExp(`${''.padEnd(version.length)}$`), version);
  new Logger(logArr.join('\n'));

  let configPath = 'config.yml';
  if (/dist$/.test(process.cwd())) {
    if (!fs.existsSync(configPath) && fs.existsSync(join('../', configPath))) {
      configPath = join('../', configPath);
    }
  }
  if (!fs.existsSync(configPath)) {
    configPath = 'config/config.yml';
    if (/dist$/.test(process.cwd())) {
      if (!fs.existsSync(configPath) && fs.existsSync(join('../', configPath))) {
        configPath = join('../', configPath);
      }
    }
  }
  if (!fs.existsSync(configPath)) {
    new Logger(chalk.red(`${__('configFileNotFound')}[${chalk.yellow(resolve(configPath))}]!`));
    return;
  }

  if (!fs.existsSync('version') || (fs.readFileSync('version').toString() !== version && fs.existsSync('CHANGELOG.txt'))) {
    new Logger(chalk.green(__('updateContent')));
    console.table(fs.readFileSync('CHANGELOG.txt').toString().trim()
      .split('\n')
      .map((e) => e.trim().replace('- ', '')));
    fs.writeFileSync('version', version);
  }

  globalThis.userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/103.0.5060.134 Safari/537.36 Edg/103.0.1264.77';

  const defaultConfig: config = {
    language: 'zh',
    awaHost: 'www.alienwarearena.com',
    awaBoosterNotice: true,
    awaQuests: ['dailyQuest', 'timeOnSite', 'watchTwitch', 'steamQuest'],
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
      new Logger(time() + chalk.red(__('configFileErrorAlter', chalk.blue(error.mark.line + 1), chalk.yellow(__('configFileErrorLocation')))));
      new Logger(error.message);
    });
  if (!config) {
    return;
  }
  const {
    language,
    timeout,
    awaCookie,
    awaHost,
    awaBoosterNotice,
    awaQuests,
    awaDailyQuestType,
    awaDailyQuestNumber1,
    boosterRule,
    boosterCorn,
    twitchCookie,
    steamUse,
    asfProtocol,
    asfHost,
    asfPort,
    asfPassword,
    asfBotname,
    steamAccountName,
    steamPassword,
    proxy,
    webUI,
    pusher,
    autoLogin,
    autoUpdateDailyQuestDb,
    awaSafeReply,
    joinSteamCommunityEvent
  }: config = config;
  globalThis.webUI = !!webUI?.enable;
  globalThis.language = language || 'zh';
  globalThis.pusher = pusher;
  globalThis.awaHost = awaHost || 'www.alienwarearena.com';
  i18n.setLocale(language);

  if (pusher?.enable && proxy?.enable?.includes('pusher')) {
    globalThis.pusherProxy = proxy;
  }

  if (timeout && typeof timeout === 'number' && timeout > 0) {
    setTimeout(async () => {
      new Logger(chalk.yellow(__('processTimeout')));
      await push(`${__('pushTitle')}\n${__('processTimeout')}${globalThis.quest?.formatQuestInfo ? `\n\n${Object.entries(globalThis.quest.formatQuestInfo()).map(([name, value]) => (name === __('steamCommunityEvent') ? `${name}:  ${value[__('obtainedARP')]}/${value[__('maxAvailableARP')]}` : `${name}:  ${value[__('obtainedARP')]} ARP`)).join('\n')}` : ''}`);
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

    server.listen(port, () => {
      new Logger(time() + __('webUIStart', chalk.yellow(`${webUI.ssl ? 'https' : 'http'}://localhost:${port}`)));
    });
  }

  const missingAwaParams = Object.entries({
    awaCookie
  }).filter(([name, value]) => name !== 'proxy' && !value).map(([name]) => name);
  if (missingAwaParams.length > 0) {
    new Logger(chalk.red(__('missingParams')));
    new Logger(missingAwaParams);
    return;
  }

  await checkUpdate(version, proxy);

  const quest = new DailyQuest({
    awaCookie: awaCookie as string,
    awaBoosterNotice: awaBoosterNotice as boolean,
    awaDailyQuestType,
    awaDailyQuestNumber1,
    boosterRule,
    boosterCorn,
    proxy,
    autoLogin,
    autoUpdateDailyQuestDb,
    doTaskUS: awaQuests.includes('dailyQuestUS'),
    awaSafeReply,
    joinSteamCommunityEvent
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
      await push(`${__('pushTitle')}\n${__('processInitError')}\n\n${initError}, ${__('checkLog')}`);
    } catch (e) {
      await push(`${__('pushTitle')}\n${__('processInitError')}`);
    }
    process.exit(0);
    return;
  }
  fs.writeFileSync(configPath, configString.replace(awaCookie as string, quest.newCookie));
  await quest.listen(null, null, true);
  globalThis.quest = quest;
  if (awaQuests.includes('dailyQuest') && (quest.questInfo.dailyQuest || []).filter((e) => e.status === 'complete').length !== quest.questInfo.dailyQuest?.length) {
    await quest.do();
  }
  if (awaQuests.includes('dailyQuestUS')) {
    await quest.doQuestUS();
  }
  if (awaQuests.includes('timeOnSite') && quest.questInfo.timeOnSite?.addedArp !== quest.questInfo.timeOnSite?.maxArp) {
    quest.track();
  }
  await sleep(10);

  let twitch: TwitchTrack | null = null;
  if (awaQuests.includes('watchTwitch')) {
    if (quest.questInfo.watchTwitch !== '15') {
      if (twitchCookie) {
        twitch = new TwitchTrack({ cookie: twitchCookie, proxy });
        if (await twitch.init() === true) {
          twitch.sendTrack();
          await sleep(10);
        }
      } else {
        new Logger(time() + chalk.yellow(__('missingTwitchParams', chalk.blue('["twitchCookie"]'))));
      }
    } else {
      new Logger(time() + chalk.green(__('twitchTaskCompleted')));
    }
  }

  let steamQuest: SteamQuestASF | SteamQuestSU | null = null;
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
          awaCookie: quest.newCookie,
          asfProtocol,
          asfHost: asfHost as string,
          asfPort: asfPort as number,
          asfPassword,
          asfBotname: asfBotname as string,
          proxy
        });
        if (await steamQuest.init()) {
          steamQuest.playGames();
          await sleep(30);
        }
      }
    }
  } else if (steamUse === 'SU') {
    const missingAsfParams = Object.entries({
      steamAccountName,
      steamPassword
    }).filter(([name, value]) => name !== 'proxy' && !value).map(([name]) => name);
    if (awaQuests.includes('steamQuest')) {
      if (missingAsfParams.length > 0) {
        new Logger(time() + chalk.yellow(__('missingSteamParams', chalk.blue(JSON.stringify(missingAsfParams)))));
      } else {
        steamQuest = new SteamQuestSU({
          awaCookie: quest.newCookie,
          steamAccountName: steamAccountName as string,
          steamPassword: steamPassword as string,
          proxy
        });
        if (await steamQuest.init()) {
          steamQuest.playGames();
          await sleep(30);
        }
      }
    }
  }
  quest.listen(twitch, steamQuest);
})();
