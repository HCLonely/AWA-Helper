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
import { sleep, log, time, checkUpdate } from './tool';
import * as chalk from 'chalk';
import * as yamlLint from 'yaml-lint';
import * as i18n from 'i18n';

(async () => {
  i18n.configure({
    locales: ['zh'],
    directory: path.join(process.cwd(), '/locales'),
    extension: '.json',
    defaultLocale: 'zh',
    register: globalThis
  });
  if (fs.existsSync('lock')) {
    try {
      fs.unlinkSync('lock');
    } catch (e) {
      log(chalk.red(__('running')));
      log(chalk.blue(__('multipleAccountAlert')));
      log(__('exitAlert'));
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
    log(chalk.red(__('running')));
    log(chalk.blue(__('multipleAccountAlert')));
    log(__('exitAlert'));
    process.stdin.setRawMode(true);
    process.stdin.on('data', () => process.exit(0));
    return;
  }
  fs.writeFileSync('log.txt', '');
  const version = 'V__VERSION__ ';
  const logArr = '  ______   __       __   ______           __    __            __                               \n /      \\ /  |  _  /  | /      \\         /  |  /  |          /  |                              \n/$$$$$$  |$$ | / \\ $$ |/$$$$$$  |        $$ |  $$ |  ______  $$ |  ______    ______    ______  \n$$ |__$$ |$$ |/$  \\$$ |$$ |__$$ | ______ $$ |__$$ | /      \\ $$ | /      \\  /      \\  /      \\ \n$$    $$ |$$ /$$$  $$ |$$    $$ |/      |$$    $$ |/$$$$$$  |$$ |/$$$$$$  |/$$$$$$  |/$$$$$$  |\n$$$$$$$$ |$$ $$/$$ $$ |$$$$$$$$ |$$$$$$/ $$$$$$$$ |$$    $$ |$$ |$$ |  $$ |$$    $$ |$$ |  $$/ \n$$ |  $$ |$$$$/  $$$$ |$$ |  $$ |        $$ |  $$ |$$$$$$$$/ $$ |$$ |__$$ |$$$$$$$$/ $$ |      \n$$ |  $$ |$$$/    $$$ |$$ |  $$ |        $$ |  $$ |$$       |$$ |$$    $$/ $$       |$$ |      \n$$/   $$/ $$/      $$/ $$/   $$/         $$/   $$/  $$$$$$$/ $$/ $$$$$$$/   $$$$$$$/ $$/       \n                                                                 $$ |                          \n                                                                 $$ |                          \n                                                                 $$/               by HCLonely '.split('\n');
  logArr[logArr.length - 2] = logArr[logArr.length - 2].replace(new RegExp(`${''.padEnd(version.length)}$`), version);
  log(logArr.join('\n'));

  let configPath = 'config.yml';
  if (/dist$/.test(process.cwd())) {
    if (!fs.existsSync(configPath) && fs.existsSync(join('../', configPath))) {
      configPath = join('../', configPath);
    }
  }
  if (!fs.existsSync(configPath)) {
    log(chalk.red(`${__('configFileNotFound')}[${chalk.yellow(resolve(configPath))}]!`));
    return;
  }

  if (!fs.existsSync('version') || (fs.readFileSync('version').toString() !== version && fs.existsSync('CHANGELOG.txt'))) {
    log(chalk.green(__('updateContent')));
    console.table(fs.readFileSync('CHANGELOG.txt').toString().trim()
      .split('\n')
      .map((e) => e.trim().replace('- ', '')));
    fs.writeFileSync('version', version);
  }

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
      log(time() + chalk.red(__('configFileErrorAlter', chalk.blue(error.mark.line + 1), chalk.yellow(__('configFileErrorLocation')))));
      log(error.message);
    });
  if (!config) {
    return;
  }
  const {
    language,
    awaCookie,
    awaHost,
    awaBoosterNotice,
    awaQuests,
    awaDailyQuestType,
    twitchCookie,
    steamUse,
    asfProtocol,
    asfHost,
    asfPort,
    asfPassword,
    asfBotname,
    steamAccountName,
    steamPassword,
    proxy
  }: config = config;
  i18n.setLocale(language);
  const missingAwaParams = Object.entries({
    awaCookie
  }).filter(([name, value]) => name !== 'proxy' && !value).map(([name]) => name);
  if (missingAwaParams.length > 0) {
    log(chalk.red(__('missingParams')));
    log(missingAwaParams);
    return;
  }
  await checkUpdate(version, proxy);
  const quest = new DailyQuest({
    awaCookie: awaCookie as string,
    awaHost: awaHost as string,
    awaBoosterNotice: awaBoosterNotice as boolean,
    awaDailyQuestType,
    proxy
  });
  if (await quest.init() !== 200) return;
  await quest.listen(null, null, true);
  if (awaQuests.includes('dailyQuest') && quest.questInfo.dailyQuest?.status !== 'complete') {
    await quest.do();
  }
  if (awaQuests.includes('timeOnSite') && quest.questInfo.timeOnSite?.addedArp !== quest.questInfo.timeOnSite?.maxArp) {
    quest.track();
  }
  await sleep(10);

  let twitch: TwitchTrack | null = null;
  if (awaQuests.includes('watchTwitch')) {
    if (quest.questInfo.watchTwitch !== '15') {
      if (twitchCookie) {
        twitch = new TwitchTrack({ awaHost, cookie: twitchCookie, proxy });
        if (await twitch.init() === true) {
          twitch.sendTrack();
          await sleep(10);
        }
      } else {
        log(time() + chalk.yellow(__('missingTwitchParams', chalk.blue('["twitchCookie"]'))));
      }
    } else {
      log(time() + chalk.green(__('twitchTaskCompleted')));
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
        log(time() + chalk.yellow(__('missingSteamParams', chalk.blue(JSON.stringify(missingAsfParams)))));
      } else {
        steamQuest = new SteamQuestASF({
          awaCookie: quest.headers.cookie as string,
          awaHost,
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
        log(time() + chalk.yellow(__('missingSteamParams', chalk.blue(JSON.stringify(missingAsfParams)))));
      } else {
        steamQuest = new SteamQuestSU({
          awaCookie: quest.headers.cookie as string,
          awaHost,
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
