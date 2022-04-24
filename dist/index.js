"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/* eslint-disable max-len */
const DailyQuest_1 = require("./DailyQuest");
const TwitchTrack_1 = require("./TwitchTrack");
const SteamQuest_1 = require("./SteamQuest");
const fs = require("fs");
const yaml_1 = require("yaml");
const tool_1 = require("./tool");
const chalk = require("chalk");
(async () => {
    fs.writeFileSync('log.txt', '');
    const version = 'V1.0.16 ';
    const logArr = '  ______   __       __   ______           __    __            __                               \n /      \\ /  |  _  /  | /      \\         /  |  /  |          /  |                              \n/$$$$$$  |$$ | / \\ $$ |/$$$$$$  |        $$ |  $$ |  ______  $$ |  ______    ______    ______  \n$$ |__$$ |$$ |/$  \\$$ |$$ |__$$ | ______ $$ |__$$ | /      \\ $$ | /      \\  /      \\  /      \\ \n$$    $$ |$$ /$$$  $$ |$$    $$ |/      |$$    $$ |/$$$$$$  |$$ |/$$$$$$  |/$$$$$$  |/$$$$$$  |\n$$$$$$$$ |$$ $$/$$ $$ |$$$$$$$$ |$$$$$$/ $$$$$$$$ |$$    $$ |$$ |$$ |  $$ |$$    $$ |$$ |  $$/ \n$$ |  $$ |$$$$/  $$$$ |$$ |  $$ |        $$ |  $$ |$$$$$$$$/ $$ |$$ |__$$ |$$$$$$$$/ $$ |      \n$$ |  $$ |$$$/    $$$ |$$ |  $$ |        $$ |  $$ |$$       |$$ |$$    $$/ $$       |$$ |      \n$$/   $$/ $$/      $$/ $$/   $$/         $$/   $$/  $$$$$$$/ $$/ $$$$$$$/   $$$$$$$/ $$/       \n                                                                 $$ |                          \n                                                                 $$ |                          \n                                                                 $$/               by HCLonely '.split('\n');
    logArr[logArr.length - 2] = logArr[logArr.length - 2].replace(new RegExp(`${''.padEnd(version.length)}$`), version);
    (0, tool_1.log)(logArr.join('\n'));
    if (!fs.existsSync('config.yml')) {
        (0, tool_1.log)(chalk.red(`没有找到配置文件[${chalk.yellow('config.yml')}]!`));
        return;
    }
    const { awaCookie, awaHost, awaUserId, awaBorderId, awaBadgeIds, awaBoosterNotice, twitchCookie, asfProtocol, asfHost, asfPort, asfPassword, asfBotname, proxy } = (0, yaml_1.parse)(fs.readFileSync('config.yml').toString());
    const missingAwaParams = Object.entries({
        awaCookie,
        awaUserId,
        awaBorderId,
        awaBadgeIds
    }).filter(([name, value]) => name !== 'proxy' && !value).map(([name]) => name);
    if (missingAwaParams.length > 0) {
        (0, tool_1.log)(chalk.red('缺少以下参数: '));
        console.log(missingAwaParams);
        return;
    }
    await (0, tool_1.checkUpdate)(version, proxy);
    const quest = new DailyQuest_1.DailyQuest({ awaCookie, awaHost, awaUserId, awaBorderId, awaBadgeIds, awaBoosterNotice, proxy });
    if (await quest.init() !== 200)
        return;
    await quest.listen(null, null, true);
    if (quest.questInfo.dailyQuest?.status !== 'complete') {
        await quest.do();
    }
    if (quest.questInfo.timeOnSite?.addedArp !== quest.questInfo.timeOnSite?.maxArp) {
        quest.track();
    }
    await (0, tool_1.sleep)(10);
    let twitch = null;
    if (quest.questInfo.watchTwitch !== '15') {
        if (twitchCookie) {
            twitch = new TwitchTrack_1.TwitchTrack({ awaHost, cookie: twitchCookie, proxy });
            if (await twitch.init() === true) {
                twitch.sendTrack();
                await (0, tool_1.sleep)(10);
            }
        }
        else {
            (0, tool_1.log)((0, tool_1.time)() + chalk.yellow(`缺少${chalk.blue('["twitchCookie"]')}参数，跳过Twitch相关任务！`));
        }
    }
    else {
        (0, tool_1.log)((0, tool_1.time)() + chalk.green('Twitch在线任务已完成！'));
    }
    let steamQuest = null;
    const missingAsfParams = Object.entries({
        asfProtocol,
        asfHost,
        asfPort,
        asfBotname
    }).filter(([name, value]) => name !== 'proxy' && !value).map(([name]) => name);
    if (missingAsfParams.length > 0) {
        (0, tool_1.log)((0, tool_1.time)() + chalk.yellow(`缺少${chalk.blue(JSON.stringify(missingAsfParams))}参数，跳过Steam相关任务！`));
    }
    else {
        steamQuest = new SteamQuest_1.SteamQuest({ awaCookie: quest.headers.cookie, awaHost, asfProtocol, asfHost, asfPort, asfPassword, asfBotname, proxy });
        if (await steamQuest.init()) {
            steamQuest.playGames();
            await (0, tool_1.sleep)(30);
        }
    }
    quest.listen(twitch, steamQuest);
})();
