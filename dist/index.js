"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/* eslint-disable max-len */
/* global config */
const DailyQuest_1 = require("./DailyQuest");
const TwitchTrack_1 = require("./TwitchTrack");
const SteamQuest_1 = require("./SteamQuest");
const fs = require("fs");
const yaml_1 = require("yaml");
const tool_1 = require("./tool");
const chalk = require("chalk");
const yamlLint = require("yaml-lint");
(async () => {
    fs.writeFileSync('log.txt', '');
    const version = 'V1.1.4 ';
    const logArr = '  ______   __       __   ______           __    __            __                               \n /      \\ /  |  _  /  | /      \\         /  |  /  |          /  |                              \n/$$$$$$  |$$ | / \\ $$ |/$$$$$$  |        $$ |  $$ |  ______  $$ |  ______    ______    ______  \n$$ |__$$ |$$ |/$  \\$$ |$$ |__$$ | ______ $$ |__$$ | /      \\ $$ | /      \\  /      \\  /      \\ \n$$    $$ |$$ /$$$  $$ |$$    $$ |/      |$$    $$ |/$$$$$$  |$$ |/$$$$$$  |/$$$$$$  |/$$$$$$  |\n$$$$$$$$ |$$ $$/$$ $$ |$$$$$$$$ |$$$$$$/ $$$$$$$$ |$$    $$ |$$ |$$ |  $$ |$$    $$ |$$ |  $$/ \n$$ |  $$ |$$$$/  $$$$ |$$ |  $$ |        $$ |  $$ |$$$$$$$$/ $$ |$$ |__$$ |$$$$$$$$/ $$ |      \n$$ |  $$ |$$$/    $$$ |$$ |  $$ |        $$ |  $$ |$$       |$$ |$$    $$/ $$       |$$ |      \n$$/   $$/ $$/      $$/ $$/   $$/         $$/   $$/  $$$$$$$/ $$/ $$$$$$$/   $$$$$$$/ $$/       \n                                                                 $$ |                          \n                                                                 $$ |                          \n                                                                 $$/               by HCLonely '.split('\n');
    logArr[logArr.length - 2] = logArr[logArr.length - 2].replace(new RegExp(`${''.padEnd(version.length)}$`), version);
    (0, tool_1.log)(logArr.join('\n'));
    if (!fs.existsSync('config.yml')) {
        (0, tool_1.log)(chalk.red(`没有找到配置文件[${chalk.yellow('config.yml')}]!`));
        return;
    }
    if (!fs.existsSync('version') || (fs.readFileSync('version').toString() !== version && fs.existsSync('CHANGELOG.txt'))) {
        (0, tool_1.log)(chalk.green('此版本更新内容：'));
        console.table(fs.readFileSync('CHANGELOG.txt').toString().trim()
            .split('\n')
            .map((e) => e.trim().replace('- ', '')));
        fs.writeFileSync('version', version);
    }
    const defaultConfig = {
        awaHost: 'www.alienwarearena.com',
        awaBoosterNotice: true,
        awaQuests: ['dailyQuest', 'timeOnSite', 'watchTwitch', 'steamQuest'],
        asfProtocol: 'http'
    };
    const configString = fs.readFileSync('config.yml').toString();
    let config = null;
    await yamlLint
        .lint(configString)
        .then(() => {
        config = { ...defaultConfig, ...(0, yaml_1.parse)(configString) };
    })
        .catch((error) => {
        (0, tool_1.log)((0, tool_1.time)() + chalk.red(`配置文件第 ${chalk.blue(error.mark.line + 1)} 行格式错误, ${chalk.yellow('以下是错误原因及错误位置')}`));
        (0, tool_1.log)(error.message);
    });
    if (!config) {
        return;
    }
    const { awaCookie, awaHost, awaUserId, awaBorderId, awaBadgeIds, awaBoosterNotice, awaQuests, twitchCookie, asfProtocol, asfHost, asfPort, asfPassword, asfBotname, proxy } = config;
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
    const quest = new DailyQuest_1.DailyQuest({
        awaCookie: awaCookie,
        awaHost: awaHost,
        awaUserId: awaUserId,
        awaBorderId: awaBorderId,
        awaBadgeIds: awaBadgeIds,
        awaBoosterNotice: awaBoosterNotice,
        proxy
    });
    if (await quest.init() !== 200)
        return;
    await quest.listen(null, null, true);
    if (awaQuests.includes('dailyQuest') && quest.questInfo.dailyQuest?.status !== 'complete') {
        await quest.do();
    }
    if (awaQuests.includes('timeOnSite') && quest.questInfo.timeOnSite?.addedArp !== quest.questInfo.timeOnSite?.maxArp) {
        quest.track();
    }
    await (0, tool_1.sleep)(10);
    let twitch = null;
    if (awaQuests.includes('watchTwitch')) {
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
    }
    let steamQuest = null;
    const missingAsfParams = Object.entries({
        asfProtocol,
        asfHost,
        asfPort,
        asfBotname
    }).filter(([name, value]) => name !== 'proxy' && !value).map(([name]) => name);
    if (awaQuests.includes('steamQuest')) {
        if (missingAsfParams.length > 0) {
            (0, tool_1.log)((0, tool_1.time)() + chalk.yellow(`缺少${chalk.blue(JSON.stringify(missingAsfParams))}参数，跳过Steam相关任务！`));
        }
        else {
            steamQuest = new SteamQuest_1.SteamQuest({
                awaCookie: quest.headers.cookie,
                awaHost,
                asfProtocol,
                asfHost: asfHost,
                asfPort: asfPort,
                asfPassword,
                asfBotname: asfBotname,
                proxy
            });
            if (await steamQuest.init()) {
                steamQuest.playGames();
                await (0, tool_1.sleep)(30);
            }
        }
    }
    quest.listen(twitch, steamQuest);
})();
