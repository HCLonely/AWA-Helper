/* eslint-disable max-len */
import { DailyQuest } from './DailyQuest';
import { TwitchTrack } from './TwitchTrack';
import { SteamQuest } from './SteamQuest';
import * as fs from 'fs';
import { parse } from 'yaml';
import { sleep, log, time } from './tool';
import * as chalk from 'chalk';

(async () => {
  fs.writeFileSync('log.txt', '');
  log('  ______   __       __   ______           __    __            __                               \n /      \\ /  |  _  /  | /      \\         /  |  /  |          /  |                              \n/$$$$$$  |$$ | / \\ $$ |/$$$$$$  |        $$ |  $$ |  ______  $$ |  ______    ______    ______  \n$$ |__$$ |$$ |/$  \\$$ |$$ |__$$ | ______ $$ |__$$ | /      \\ $$ | /      \\  /      \\  /      \\ \n$$    $$ |$$ /$$$  $$ |$$    $$ |/      |$$    $$ |/$$$$$$  |$$ |/$$$$$$  |/$$$$$$  |/$$$$$$  |\n$$$$$$$$ |$$ $$/$$ $$ |$$$$$$$$ |$$$$$$/ $$$$$$$$ |$$    $$ |$$ |$$ |  $$ |$$    $$ |$$ |  $$/ \n$$ |  $$ |$$$$/  $$$$ |$$ |  $$ |        $$ |  $$ |$$$$$$$$/ $$ |$$ |__$$ |$$$$$$$$/ $$ |      \n$$ |  $$ |$$$/    $$$ |$$ |  $$ |        $$ |  $$ |$$       |$$ |$$    $$/ $$       |$$ |      \n$$/   $$/ $$/      $$/ $$/   $$/         $$/   $$/  $$$$$$$/ $$/ $$$$$$$/   $$$$$$$/ $$/       \n                                                                 $$ |                          \n                                                                 $$ |                          \n                                                                 $$/               by HCLonely ');

  if (!fs.existsSync('config.yml')) {
    log(chalk.red(`没有找到配置文件[${chalk.yellow('config.yml')}]!`));
    return;
  }
  const {
    awaCookie,
    awaUserId,
    awaBorderId,
    awaBadgeIds,
    twitchCookie,
    asfProtocol,
    asfHost,
    asfPort,
    asfPassword,
    asfBotname,
    proxy
  } = parse(fs.readFileSync('config.yml').toString());
  const missingAwaParams = Object.entries({
    awaCookie,
    awaUserId,
    awaBorderId,
    awaBadgeIds
  }).filter(([name, value]) => name !== 'proxy' && !value).map(([name]) => name);
  if (missingAwaParams.length > 0) {
    log(chalk.red('缺少以下参数: '));
    console.log(missingAwaParams);
    return;
  }
  const quest = new DailyQuest(awaCookie, awaUserId, awaBorderId, awaBadgeIds, proxy);
  if (await quest.init() !== 200) return;
  await quest.listen(null, null, true);
  if (quest.questInfo.dailyQuest?.status !== 'complete') {
    await quest.do();
  }
  if (quest.questInfo.timeOnSite?.addedArp !== quest.questInfo.timeOnSite?.maxArp) {
    quest.sendTrack();
  }
  await sleep(10);

  let twitch: TwitchTrack | null = null;
  if (quest.questInfo.watchTwitch !== '15') {
    if (twitchCookie) {
      twitch = new TwitchTrack(twitchCookie, proxy);
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

  let steamQuest: SteamQuest | null = null;
  const missingAsfParams = Object.entries({
    asfProtocol,
    asfHost,
    asfPort,
    asfPassword,
    asfBotname
  }).filter(([name, value]) => name !== 'proxy' && !value).map(([name]) => name);
  if (missingAsfParams.length > 0) {
    log(chalk.yellow(`缺少${chalk.blue(JSON.stringify(missingAsfParams))}参数，跳过Steam相关任务！`));
  } else {
    steamQuest = new SteamQuest(awaCookie, asfProtocol, asfHost, asfPort, asfPassword, asfBotname, proxy);
    if (await steamQuest.init()) {
      steamQuest.playGames();
      await sleep(30);
    }
  }
  quest.listen(twitch, steamQuest);
})();
