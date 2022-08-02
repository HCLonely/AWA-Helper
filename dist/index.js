"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/* eslint-disable max-len */
/* global config, __ */
const DailyQuest_1 = require("./DailyQuest");
const TwitchTrack_1 = require("./TwitchTrack");
const SteamQuestASF_1 = require("./SteamQuestASF");
const SteamQuestSU_1 = require("./SteamQuestSU");
const fs = require("fs");
const path = require("path");
const path_1 = require("path");
const yaml_1 = require("yaml");
const tool_1 = require("./tool");
const chalk = require("chalk");
const yamlLint = require("yaml-lint");
const i18n = require("i18n");
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
        }
        catch (e) {
            (0, tool_1.log)(chalk.red(__('running')));
            (0, tool_1.log)(chalk.blue(__('multipleAccountAlert')));
            (0, tool_1.log)(__('exitAlert'));
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
        (0, tool_1.log)(chalk.red(__('running')));
        (0, tool_1.log)(chalk.blue(__('multipleAccountAlert')));
        (0, tool_1.log)(__('exitAlert'));
        process.stdin.setRawMode(true);
        process.stdin.on('data', () => process.exit(0));
        return;
    }
    fs.writeFileSync('log.txt', '');
    const version = 'V1.3.0 ';
    const logArr = '  ______   __       __   ______           __    __            __                               \n /      \\ /  |  _  /  | /      \\         /  |  /  |          /  |                              \n/$$$$$$  |$$ | / \\ $$ |/$$$$$$  |        $$ |  $$ |  ______  $$ |  ______    ______    ______  \n$$ |__$$ |$$ |/$  \\$$ |$$ |__$$ | ______ $$ |__$$ | /      \\ $$ | /      \\  /      \\  /      \\ \n$$    $$ |$$ /$$$  $$ |$$    $$ |/      |$$    $$ |/$$$$$$  |$$ |/$$$$$$  |/$$$$$$  |/$$$$$$  |\n$$$$$$$$ |$$ $$/$$ $$ |$$$$$$$$ |$$$$$$/ $$$$$$$$ |$$    $$ |$$ |$$ |  $$ |$$    $$ |$$ |  $$/ \n$$ |  $$ |$$$$/  $$$$ |$$ |  $$ |        $$ |  $$ |$$$$$$$$/ $$ |$$ |__$$ |$$$$$$$$/ $$ |      \n$$ |  $$ |$$$/    $$$ |$$ |  $$ |        $$ |  $$ |$$       |$$ |$$    $$/ $$       |$$ |      \n$$/   $$/ $$/      $$/ $$/   $$/         $$/   $$/  $$$$$$$/ $$/ $$$$$$$/   $$$$$$$/ $$/       \n                                                                 $$ |                          \n                                                                 $$ |                          \n                                                                 $$/               by HCLonely '.split('\n');
    logArr[logArr.length - 2] = logArr[logArr.length - 2].replace(new RegExp(`${''.padEnd(version.length)}$`), version);
    (0, tool_1.log)(logArr.join('\n'));
    let configPath = 'config.yml';
    if (/dist$/.test(process.cwd())) {
        if (!fs.existsSync(configPath) && fs.existsSync((0, path_1.join)('../', configPath))) {
            configPath = (0, path_1.join)('../', configPath);
        }
    }
    if (!fs.existsSync(configPath)) {
        (0, tool_1.log)(chalk.red(`${__('configFileNotFound')}[${chalk.yellow((0, path_1.resolve)(configPath))}]!`));
        return;
    }
    if (!fs.existsSync('version') || (fs.readFileSync('version').toString() !== version && fs.existsSync('CHANGELOG.txt'))) {
        (0, tool_1.log)(chalk.green(__('updateContent')));
        console.table(fs.readFileSync('CHANGELOG.txt').toString().trim()
            .split('\n')
            .map((e) => e.trim().replace('- ', '')));
        fs.writeFileSync('version', version);
    }
    const defaultConfig = {
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
    let config = null;
    await yamlLint
        .lint(configString)
        .then(() => {
        config = { ...defaultConfig, ...(0, yaml_1.parse)(configString) };
    })
        .catch((error) => {
        (0, tool_1.log)((0, tool_1.time)() + chalk.red(__('configFileErrorAlter', chalk.blue(error.mark.line + 1), chalk.yellow(__('configFileErrorLocation')))));
        (0, tool_1.log)(error.message);
    });
    if (!config) {
        return;
    }
    const { language, awaCookie, awaHost, awaBoosterNotice, awaQuests, awaDailyQuestType, twitchCookie, steamUse, asfProtocol, asfHost, asfPort, asfPassword, asfBotname, steamAccountName, steamPassword, proxy } = config;
    i18n.setLocale(language);
    const missingAwaParams = Object.entries({
        awaCookie
    }).filter(([name, value]) => name !== 'proxy' && !value).map(([name]) => name);
    if (missingAwaParams.length > 0) {
        (0, tool_1.log)(chalk.red(__('missingParams')));
        (0, tool_1.log)(missingAwaParams);
        return;
    }
    await (0, tool_1.checkUpdate)(version, proxy);
    const quest = new DailyQuest_1.DailyQuest({
        awaCookie: awaCookie,
        awaHost: awaHost,
        awaBoosterNotice: awaBoosterNotice,
        awaDailyQuestType,
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
                (0, tool_1.log)((0, tool_1.time)() + chalk.yellow(__('missingTwitchParams', chalk.blue('["twitchCookie"]'))));
            }
        }
        else {
            (0, tool_1.log)((0, tool_1.time)() + chalk.green(__('twitchTaskCompleted')));
        }
    }
    let steamQuest = null;
    if (!steamUse || steamUse === 'ASF') {
        const missingAsfParams = Object.entries({
            asfProtocol,
            asfHost,
            asfPort,
            asfBotname
        }).filter(([name, value]) => name !== 'proxy' && !value).map(([name]) => name);
        if (awaQuests.includes('steamQuest')) {
            if (missingAsfParams.length > 0) {
                (0, tool_1.log)((0, tool_1.time)() + chalk.yellow(__('missingSteamParams', chalk.blue(JSON.stringify(missingAsfParams)))));
            }
            else {
                steamQuest = new SteamQuestASF_1.SteamQuestASF({
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
    }
    else if (steamUse === 'SU') {
        const missingAsfParams = Object.entries({
            steamAccountName,
            steamPassword
        }).filter(([name, value]) => name !== 'proxy' && !value).map(([name]) => name);
        if (awaQuests.includes('steamQuest')) {
            if (missingAsfParams.length > 0) {
                (0, tool_1.log)((0, tool_1.time)() + chalk.yellow(__('missingSteamParams', chalk.blue(JSON.stringify(missingAsfParams)))));
            }
            else {
                steamQuest = new SteamQuestSU_1.SteamQuestSU({
                    awaCookie: quest.headers.cookie,
                    awaHost,
                    steamAccountName: steamAccountName,
                    steamPassword: steamPassword,
                    proxy
                });
                if (await steamQuest.init()) {
                    steamQuest.playGames();
                    await (0, tool_1.sleep)(30);
                }
            }
        }
    }
    quest.listen(twitch, steamQuest);
})();
