/* eslint-disable max-len */
/* global config */
import { DailyQuest } from './DailyQuest';
import { TwitchTrack } from './TwitchTrack';
import { SteamQuest } from './SteamQuest';
import * as fs from 'fs';
import { parse } from 'yaml';
import { sleep, log, time, checkUpdate } from './tool';
import * as chalk from 'chalk';
import * as yamlLint from 'yaml-lint';

(async () => {
  fs.writeFileSync('log.txt', '');
  const version = 'V__VERSION__ ';
  const logArr = '  ______   __       __   ______           __    __            __                               \n /      \\ /  |  _  /  | /      \\         /  |  /  |          /  |                              \n/$$$$$$  |$$ | / \\ $$ |/$$$$$$  |        $$ |  $$ |  ______  $$ |  ______    ______    ______  \n$$ |__$$ |$$ |/$  \\$$ |$$ |__$$ | ______ $$ |__$$ | /      \\ $$ | /      \\  /      \\  /      \\ \n$$    $$ |$$ /$$$  $$ |$$    $$ |/      |$$    $$ |/$$$$$$  |$$ |/$$$$$$  |/$$$$$$  |/$$$$$$  |\n$$$$$$$$ |$$ $$/$$ $$ |$$$$$$$$ |$$$$$$/ $$$$$$$$ |$$    $$ |$$ |$$ |  $$ |$$    $$ |$$ |  $$/ \n$$ |  $$ |$$$$/  $$$$ |$$ |  $$ |        $$ |  $$ |$$$$$$$$/ $$ |$$ |__$$ |$$$$$$$$/ $$ |      \n$$ |  $$ |$$$/    $$$ |$$ |  $$ |        $$ |  $$ |$$       |$$ |$$    $$/ $$       |$$ |      \n$$/   $$/ $$/      $$/ $$/   $$/         $$/   $$/  $$$$$$$/ $$/ $$$$$$$/   $$$$$$$/ $$/       \n                                                                 $$ |                          \n                                                                 $$ |                          \n                                                                 $$/               by HCLonely '.split('\n');
  logArr[logArr.length - 2] = logArr[logArr.length - 2].replace(new RegExp(`${''.padEnd(version.length)}$`), version);
  log(logArr.join('\n'));

  if (!fs.existsSync('config.yml')) {
    log(chalk.red(`没有找到配置文件[${chalk.yellow('config.yml')}]!`));
    return;
  }

  if (!fs.existsSync('version') || (fs.readFileSync('version').toString() !== version && fs.existsSync('CHANGELOG.txt'))) {
    log(chalk.green('此版本更新内容：'));
    console.table(fs.readFileSync('CHANGELOG.txt').toString().trim()
      .split('\n')
      .map((e) => e.trim().replace('- ', '')));
    fs.writeFileSync('version', version);
  }

  const defaultConfig: config = {
    awaHost: 'www.alienwarearena.com',
    awaBoosterNotice: true,
    awaQuests: ['dailyQuest', 'timeOnSite', 'watchTwitch', 'steamQuest'],
    asfProtocol: 'http'
  };
  const configString = fs.readFileSync('config.yml').toString();
  let config: config | null = null;
  await yamlLint
    .lint(configString)
    .then(() => {
      config = { ...defaultConfig, ...parse(configString) };
    })
    .catch((error) => {
      log(time() + chalk.red(`配置文件第 ${chalk.blue(error.mark.line + 1)} 行格式错误, ${chalk.yellow('以下是错误原因及错误位置')}`));
      log(error.message);
    });
  if (!config) {
    return;
  }
  const {
    awaCookie,
    awaHost,
    awaUserId,
    awaBorderId,
    awaBadgeIds,
    awaBoosterNotice,
    awaQuests,
    twitchCookie,
    asfProtocol,
    asfHost,
    asfPort,
    asfPassword,
    asfBotname,
    proxy
  }: config = config;
  const missingAwaParams = Object.entries({
    awaCookie,
    awaUserId,
    awaBorderId,
    awaBadgeIds
  }).filter(([name, value]) => name !== 'proxy' && !value).map(([name]) => name);
  if (missingAwaParams.length > 0) {
    log(chalk.red('缺少以下参数: '));
    log(missingAwaParams);
    return;
  }
  await checkUpdate(version, proxy);
  const quest = new DailyQuest({
    awaCookie: awaCookie as string,
    awaHost: awaHost as string,
    awaUserId: awaUserId as string,
    awaBorderId: awaBorderId as string,
    awaBadgeIds: awaBadgeIds as string,
    awaBoosterNotice: awaBoosterNotice as boolean,
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
        log(time() + chalk.yellow(`缺少${chalk.blue('["twitchCookie"]')}参数，跳过Twitch相关任务！`));
      }
    } else {
      log(time() + chalk.green('Twitch在线任务已完成！'));
    }
  }

  let steamQuest: SteamQuest | null = null;
  const missingAsfParams = Object.entries({
    asfProtocol,
    asfHost,
    asfPort,
    asfBotname
  }).filter(([name, value]) => name !== 'proxy' && !value).map(([name]) => name);
  if (awaQuests.includes('steamQuest')) {
    if (missingAsfParams.length > 0) {
      log(time() + chalk.yellow(`缺少${chalk.blue(JSON.stringify(missingAsfParams))}参数，跳过Steam相关任务！`));
    } else {
      steamQuest = new SteamQuest({
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
  quest.listen(twitch, steamQuest);
})();
