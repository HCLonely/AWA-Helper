"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SteamQuestSU = void 0;
/* eslint-disable max-len */
/* global steamGameInfo, proxy */
const fs = require("fs");
const cheerio_1 = require("cheerio");
const chalk = require("chalk");
const tool_1 = require("./tool");
const SteamUser = require("steam-user");
class SteamQuestSU {
    constructor({ awaCookie, awaHost, steamAccountName, steamPassword, proxy }) {
        this.ownedGames = [];
        this.maxPlayTimes = 2;
        this.gamesInfo = [];
        this.maxArp = 0;
        this.status = 'none';
        this.suClint = new SteamUser();
        this.awaCookie = awaCookie;
        this.awaHost = awaHost || 'www.alienwarearena.com';
        this.suInfo = {
            accountName: steamAccountName,
            rememberPassword: true
        };
        const loginKey = fs.existsSync('login-key.txt') ? fs.readFileSync('login-key.txt').toString() : null;
        if (loginKey) {
            this.suInfo.loginKey = loginKey;
        }
        else {
            (0, tool_1.log)(chalk.red(`检测到首次使用此方式[${chalk.blue('SU')}]登录Steam, 如果Steam启用了${chalk.gray('两步验证')}，请注意控制台提示输入两步验证码！`));
            this.suInfo.password = steamPassword;
        }
        if (proxy?.enable?.includes('steam') && proxy.host && proxy.port) {
            this.suClint.setOption('httpProxy', `${proxy.protocol || 'http'}://${proxy.username && proxy.password ? `${proxy.username}:${proxy.password}@` : ''}${proxy.host}:${proxy.port}`);
        }
        if (proxy?.enable?.includes('awa') && proxy.host && proxy.port) {
            this.awaHttpsAgent = (0, tool_1.formatProxy)(proxy);
        }
    }
    init() {
        (0, tool_1.log)(`${(0, tool_1.time)()}正在登录${chalk.yellow('Steam')}...`, false);
        this.suClint.logOn(this.suInfo);
        this.suClint.on('loginKey', (key) => {
            fs.writeFileSync('login-key.txt', key);
        });
        return new Promise((resolve) => {
            this.suClint.on('loggedOn', () => {
                (0, tool_1.log)(chalk.green(`OK[${chalk.gray(this.suClint.steamID?.getSteamID64())}]`));
                resolve(true);
            });
        });
    }
    async getSteamQuests() {
        (0, tool_1.log)(`${(0, tool_1.time)()}正在获取${chalk.yellow('Steam')}任务信息...`);
        const options = {
            url: `https://${this.awaHost}/steam/quests`,
            method: 'GET',
            headers: {
                accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
                'accept-encoding': 'gzip, deflate, br',
                'accept-language': 'zh-CN,zh;q=0.9,en;q=0.8,en-GB;q=0.7,en-US;q=0.6',
                'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.4896.127 Safari/537.36 Edg/100.0.1185.44'
            }
        };
        if (this.awaHttpsAgent)
            options.httpsAgent = this.awaHttpsAgent;
        return await (0, tool_1.http)(options)
            .then(async (response) => {
            globalThis.secrets = [...new Set([...globalThis.secrets.split('|'), ...(response.headers['set-cookie'] || []).map((e) => e.split(';')[0].trim().split('=')[1]).filter((e) => e && e.length > 5)])].join('|');
            if (response.status === 200) {
                const $ = (0, cheerio_1.load)(response.data);
                const gamesInfo = [];
                for (const row of $('div.container>div.row').toArray()) {
                    const $row = $(row);
                    const id = $row.find('img[src*="cdn.cloudflare.steamstatic.com/steam/apps/"]').eq(0)
                        .attr('src')
                        ?.match(/steam\/apps\/([\d]+)/)?.[1];
                    if (!id)
                        continue;
                    const questLink = new URL($row.find('a.btn-steam-quest[href]').attr('href'), `https://${this.awaHost}/`).href;
                    const started = await this.getQuestInfo(questLink);
                    if (!started)
                        continue;
                    const playTime = $row.find('.media-body p').text()
                        .trim()
                        .match(/([\d]+)[\s]*hour/i)?.[1];
                    const arp = $row.find('.text-steam-light').text()
                        .trim()
                        .match(/([\d]+)[\s]*ARP/i)?.[1];
                    gamesInfo.push({
                        id,
                        time: playTime ? parseInt(playTime, 10) : 0,
                        arp: arp ? parseInt(arp, 10) : 0,
                        link: questLink
                    });
                }
                this.gamesInfo = gamesInfo;
                (0, tool_1.log)((0, tool_1.time)() + chalk.green(`获取${chalk.yellow('Steam')}任务信息成功`));
                return true;
            }
            (0, tool_1.log)((0, tool_1.time)() + chalk.red(`获取${chalk.yellow('Steam')}任务信息失败[Net Error]: ${response.status}`));
            return false;
        })
            .catch((error) => {
            (0, tool_1.log)((0, tool_1.time)() + chalk.red(`获取${chalk.yellow('Steam')}任务信息失败`) + (0, tool_1.netError)(error));
            globalThis.secrets = [...new Set([...globalThis.secrets.split('|'), ...(error.response?.headers?.['set-cookie'] || []).map((e) => e.split(';')[0].trim().split('=')[1]).filter((e) => e && e.length > 5)])].join('|');
            (0, tool_1.log)(error);
            return false;
        });
    }
    getQuestInfo(url) {
        (0, tool_1.log)(`${(0, tool_1.time)()}正在获取Steam任务[${chalk.yellow(url.match(/steam\/quests\/(.+)/)?.[1] || url)}]信息...`, false);
        const options = {
            url,
            method: 'GET',
            responseType: 'text',
            headers: {
                cookie: this.awaCookie,
                accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
                'accept-encoding': 'gzip, deflate, br',
                'accept-language': 'zh-CN,zh;q=0.9,en;q=0.8,en-GB;q=0.7,en-US;q=0.6',
                'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.4896.127 Safari/537.36 Edg/100.0.1185.44',
                referer: 'https://www.alienwarearena.com/steam/quests'
            }
        };
        if (this.awaHttpsAgent)
            options.httpsAgent = this.awaHttpsAgent;
        return (0, tool_1.http)(options)
            .then((response) => {
            globalThis.secrets = [...new Set([...globalThis.secrets.split('|'), ...(response.headers['set-cookie'] || []).map((e) => e.split(';')[0].trim().split('=')[1]).filter((e) => e && e.length > 5)])].join('|');
            if (response.data.includes('You have completed this quest')) {
                (0, tool_1.log)(chalk.green('此任务已完成'));
                // return false;
                return true;
            }
            if (response.data.includes('This quest requires that you own')) {
                (0, tool_1.log)(chalk.yellow('未拥有此游戏，跳过'));
                return false;
            }
            if (response.data.includes('Launch Game')) {
                (0, tool_1.log)(chalk.green('此任务已开始'));
                return true;
            }
            if (response.data.includes('Start Quest')) {
                (0, tool_1.log)(chalk.green('OK'));
                return this.startQuest(url);
            }
            (0, tool_1.log)(chalk.red(`Error: ${response.status}`));
            return false;
        })
            .catch((error) => {
            (0, tool_1.log)(chalk.red('Error') + (0, tool_1.netError)(error));
            globalThis.secrets = [...new Set([...globalThis.secrets.split('|'), ...(error.response?.headers?.['set-cookie'] || []).map((e) => e.split(';')[0].trim().split('=')[1]).filter((e) => e && e.length > 5)])].join('|');
            (0, tool_1.log)(error);
            return false;
        });
    }
    startQuest(url) {
        (0, tool_1.log)(`${(0, tool_1.time)()}正在开始Steam任务[${chalk.yellow(url)}]...`, false);
        const options = {
            url: url.replace('steam/quests', 'ajax/user/steam/quests/start'),
            method: 'GET',
            headers: {
                cookie: this.awaCookie,
                'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.4896.75 Safari/537.36 Edg/100.0.1185.39',
                referer: url
            }
        };
        if (this.awaHttpsAgent)
            options.httpsAgent = this.awaHttpsAgent;
        return (0, tool_1.http)(options)
            .then((response) => {
            globalThis.secrets = [...new Set([...globalThis.secrets.split('|'), ...(response.headers['set-cookie'] || []).map((e) => e.split(';')[0].trim().split('=')[1]).filter((e) => e && e.length > 5)])].join('|');
            if (response.data.success) {
                (0, tool_1.log)(chalk.green('OK'));
                return true;
            }
            (0, tool_1.log)(chalk.red(`Error: ${response.data.message || response.status}`));
            return false;
        })
            .catch((error) => {
            (0, tool_1.log)(chalk.red('Error') + (0, tool_1.netError)(error));
            globalThis.secrets = [...new Set([...globalThis.secrets.split('|'), ...(error.response?.headers?.['set-cookie'] || []).map((e) => e.split(';')[0].trim().split('=')[1]).filter((e) => e && e.length > 5)])].join('|');
            (0, tool_1.log)(error);
            return false;
        });
    }
    async checkStatus() {
        if (this.status === 'stopped')
            return true;
        for (const index in this.taskStatus) {
            (0, tool_1.log)(`${(0, tool_1.time)()}正在检测Steam任务[${chalk.yellow(this.taskStatus[index].link)}]进度...`, false);
            const options = {
                url: this.taskStatus[index].link,
                method: 'GET',
                responseType: 'text',
                headers: {
                    cookie: this.awaCookie,
                    accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
                    'accept-encoding': 'gzip, deflate, br',
                    'accept-language': 'zh-CN,zh;q=0.9,en;q=0.8,en-GB;q=0.7,en-US;q=0.6',
                    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.4896.127 Safari/537.36 Edg/100.0.1185.44',
                    referer: 'https://www.alienwarearena.com/steam/quests'
                }
            };
            if (this.awaHttpsAgent)
                options.httpsAgent = this.awaHttpsAgent;
            await (0, tool_1.http)(options)
                .then((response) => {
                globalThis.secrets = [...new Set([...globalThis.secrets.split('|'), ...(response.headers['set-cookie'] || []).map((e) => e.split(';')[0].trim().split('=')[1]).filter((e) => e && e.length > 5)])].join('|');
                if (response.data.includes('aria-valuenow')) {
                    const progress = response.data.match(/aria-valuenow="([\d]+?)"/)?.[1];
                    if (progress) {
                        this.taskStatus[index].progress = progress;
                        (0, tool_1.log)(chalk.yellow(`${progress}%`));
                        return true;
                    }
                    (0, tool_1.log)(chalk.red('进度未找到'));
                    return false;
                }
                (0, tool_1.log)(chalk.red('进度条未找到'));
                return false;
            })
                .catch((error) => {
                (0, tool_1.log)(chalk.red('Error') + (0, tool_1.netError)(error));
                globalThis.secrets = [...new Set([...globalThis.secrets.split('|'), ...(error.response?.headers?.['set-cookie'] || []).map((e) => e.split(';')[0].trim().split('=')[1]).filter((e) => e && e.length > 5)])].join('|');
                (0, tool_1.log)(error);
                return false;
            });
        }
        if (this.taskStatus.filter((e) => parseInt(e.progress || '0', 10) >= 100).length === this.taskStatus.length) {
            (0, tool_1.log)((0, tool_1.time)() + chalk.yellow('Steam') + chalk.green('挂时长任务完成！'));
            this.resume();
            return true;
        }
        await (0, tool_1.sleep)(60 * 10);
        return await this.checkStatus();
    }
    async getOwnedGames() {
        if (!await this.getSteamQuests())
            return false;
        if (this.gamesInfo.length === 0)
            return true;
        (0, tool_1.log)(`${(0, tool_1.time)()}正在匹配${chalk.yellow('Steam')}游戏库...`, false);
        return await this.suClint.getUserOwnedApps(this.suClint.steamID?.getSteamID64(), {
            includePlayedFreeGames: true,
            filterAppids: this.gamesInfo.map((e) => parseInt(e.id, 10)),
            includeFreeSub: true
        })
            .then((response) => {
            // @ts-ignore
            this.ownedGames = response.apps.map((e) => `${e.appid}`);
            this.maxArp = this.ownedGames.map((id) => this.gamesInfo.find((info) => info.id === id)?.arp || 0).reduce((acr, cur) => acr + cur);
            this.maxPlayTimes = Math.max(...this.ownedGames.map((id) => this.gamesInfo.find((info) => info.id === id)?.time || 2));
            this.taskStatus = this.ownedGames.map((id) => this.gamesInfo.find((info) => info.id === id)).filter((e) => e);
            (0, tool_1.log)(chalk.green('OK'));
            return true;
        })
            .catch((error) => {
            (0, tool_1.log)(chalk.red('Error'));
            (0, tool_1.log)(error);
            return false;
        });
    }
    async playGames() {
        if (!await this.getOwnedGames())
            return false;
        if (this.ownedGames.length === 0) {
            (0, tool_1.log)((0, tool_1.time)() + chalk.yellow('当前账号游戏库中没有任务中的游戏，停止挂游戏时长！'));
            this.status = 'stopped';
            return false;
        }
        (0, tool_1.log)(`${(0, tool_1.time)()}正在挂游戏时长...`, false);
        this.suClint.gamesPlayed(this.ownedGames.map((e) => parseInt(e, 10)), true);
        (0, tool_1.log)(chalk.green('OK'));
        await (0, tool_1.sleep)(10 * 60);
        return await this.checkStatus();
    }
    async resume() {
        if (this.status === 'stopped')
            return true;
        (0, tool_1.log)(`${(0, tool_1.time)()}正在停止挂游戏时长...`, false);
        this.suClint.gamesPlayed([]);
        (0, tool_1.log)(chalk.green('OK'));
        return true;
    }
}
exports.SteamQuestSU = SteamQuestSU;
