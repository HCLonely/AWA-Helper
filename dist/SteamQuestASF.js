"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SteamQuestASF = void 0;
const cheerio_1 = require("cheerio");
const chalk = require("chalk");
const tool_1 = require("./tool");
class SteamQuestASF {
    constructor({ awaCookie, awaHost, asfProtocol, asfHost, asfPort, asfPassword, asfBotname, proxy }) {
        this.ownedGames = [];
        this.maxPlayTimes = 2;
        this.gamesInfo = [];
        this.maxArp = 0;
        this.status = 'none';
        this.awaCookie = awaCookie;
        this.awaHost = awaHost || 'www.alienwarearena.com';
        this.botname = asfBotname;
        this.asfUrl = `${asfProtocol}://${asfHost}:${asfPort}/Api/Command`;
        this.headers = {
            accept: 'application/json',
            'Content-Type': 'application/json',
            Host: `${asfHost}:${asfPort}`,
            Origin: `${asfProtocol}://${asfHost}:${asfPort}`,
            Referer: `${asfProtocol}://${asfHost}:${asfPort}/page/commands`
        };
        if (asfPassword)
            this.headers.Authentication = asfPassword;
        if (proxy?.enable?.includes('asf') && proxy.host && proxy.port) {
            this.httpsAgent = (0, tool_1.formatProxy)(proxy);
        }
    }
    async init() {
        (0, tool_1.log)(`${(0, tool_1.time)()}${__('initing', chalk.yellow('ASF'))}`, false);
        const options = {
            url: this.asfUrl,
            method: 'POST',
            headers: this.headers,
            data: '{"Command":"!stats"}'
        };
        if (this.httpsAgent)
            options.httpsAgent = this.httpsAgent;
        return (0, tool_1.http)(options)
            .then((response) => {
            globalThis.secrets = [...new Set([...globalThis.secrets.split('|'), ...(response.headers['set-cookie'] || []).map((e) => e.split(';')[0].trim().split('=')[1]).filter((e) => e && e.length > 5)])].join('|');
            if (response.status === 200) {
                if (response.data.Success === true && response.data.Message === 'OK' && response.data.Result) {
                    (0, tool_1.log)(chalk.green('OK'));
                    return true;
                }
                if (response.data.Message) {
                    (0, tool_1.log)(chalk.blue(response.data.Message));
                    return false;
                }
                (0, tool_1.log)(chalk.blue('Error'));
                (0, tool_1.log)(response.data);
                return false;
            }
            (0, tool_1.log)(chalk.red(`Error: ${response.status}`));
            return false;
        })
            .catch((error) => {
            (0, tool_1.log)(chalk.red('Error'));
            globalThis.secrets = [...new Set([...globalThis.secrets.split('|'), ...(error.response?.headers?.['set-cookie'] || []).map((e) => e.split(';')[0].trim().split('=')[1]).filter((e) => e && e.length > 5)])].join('|');
            (0, tool_1.log)(error);
            return false;
        });
    }
    async getSteamQuests() {
        (0, tool_1.log)(`${(0, tool_1.time)()}${__('gettingSteamQuestInfo', chalk.yellow('Steam'))}`);
        const options = {
            url: `https://${this.awaHost}/steam/quests`,
            method: 'GET',
            headers: {
                accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
                'accept-encoding': 'gzip, deflate, br',
                'accept-language': 'zh-CN,zh;q=0.9,en;q=0.8,en-GB;q=0.7,en-US;q=0.6',
                'user-agent': globalThis.userAgent
            }
        };
        if (this.httpsAgent)
            options.httpsAgent = this.httpsAgent;
        return (0, tool_1.http)(options)
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
                    // await this.add2library(id);
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
                (0, tool_1.log)(`${(0, tool_1.time)()}${chalk.green(__('getSteamQuestInfoSuccess', chalk.yellow('Steam')))}`);
                return true;
            }
            (0, tool_1.log)(`${(0, tool_1.time)()}${chalk.red(`${__('getSteamQuestInfoFailed', chalk.yellow('Steam'))}[Net Error]: ${response.status}`)}`);
            return false;
        })
            .catch((error) => {
            (0, tool_1.log)((0, tool_1.time)() + chalk.red(__('getSteamQuestInfoFailed', chalk.yellow('Steam'))) + (0, tool_1.netError)(error));
            globalThis.secrets = [...new Set([...globalThis.secrets.split('|'), ...(error.response?.headers?.['set-cookie'] || []).map((e) => e.split(';')[0].trim().split('=')[1]).filter((e) => e && e.length > 5)])].join('|');
            (0, tool_1.log)(error);
            return false;
        });
    }
    /*
    async add2library(id: string):Promise<boolean> {
      log(`${time()}${__('adding2library', chalk.yellow('ASF'), chalk.yellow(id))}`, false);
      const options: AxiosRequestConfig = {
        url: this.asfUrl,
        method: 'POST',
        headers: this.headers,
        data: `{"Command":"!addlicense ${this.botname} app/${id}"}`
        // data: `{"Command":"!addlicense ${this.botname} ${this.gamesInfo.map((e) => `app/${e.id}`).join(',')}"}`
      };
      if (this.httpsAgent) options.httpsAgent = this.httpsAgent;
      return axios(options)
        .then((response) => {
          globalThis.secrets = [...new Set([...globalThis.secrets.split('|'), ...(response.headers['set-cookie'] || []).map((e) => e.split(';')[0].trim().split('=')[1]).filter((e: any) => e && e.length > 5)])].join('|');
          if (response.status === 200) {
            if (response.data.Success === true && response.data.Message === 'OK' && response.data.Result) {
              console.log(response.data.Result);
              log(chalk.green('OK'));
              return true;
            }
            if (response.data.Message) {
              log(chalk.blue(response.data.Message));
              return false;
            }
            log(chalk.blue('Error'));
            log(response.data);
            return false;
          }
          log(chalk.red(`Error: ${response.status}`));
          return false;
        })
        .catch((error) => {
          log(chalk.red('Error'));
          globalThis.secrets = [...new Set([...globalThis.secrets.split('|'), ...(error.response?.headers?.['set-cookie'] || []).map((e: string) => e.split(';')[0].trim().split('=')[1]).filter((e: any) => e && e.length > 5)])].join('|');
          log(error);
          return false;
        });
    }
    */
    async awaCheckOwnedGames(name) {
        (0, tool_1.log)(`${(0, tool_1.time)()}${__('recheckingOwnedGames', chalk.yellow(name))}`, false);
        const taskUrl = `https://www.alienwarearena.com/steam/quests/${name}`;
        const options = {
            url: `https://www.alienwarearena.com/ajax/user/steam/quests/check-owned-games/${name}`,
            method: 'GET',
            headers: {
                cookie: this.awaCookie,
                accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
                'accept-encoding': 'gzip, deflate, br',
                'accept-language': 'zh-CN,zh;q=0.9,en;q=0.8,en-GB;q=0.7,en-US;q=0.6',
                'user-agent': globalThis.userAgent,
                referer: taskUrl
            }
        };
        if (this.httpsAgent)
            options.httpsAgent = this.httpsAgent;
        return (0, tool_1.http)(options)
            .then(async (response) => {
            globalThis.secrets = [...new Set([...globalThis.secrets.split('|'), ...(response.headers['set-cookie'] || []).map((e) => e.split(';')[0].trim().split('=')[1]).filter((e) => e && e.length > 5)])].join('|');
            if (response.status === 200) {
                if (response.data?.installed === true) {
                    (0, tool_1.log)(chalk.green(__('owned')));
                    return this.getQuestInfo(taskUrl, true);
                }
                (0, tool_1.log)(chalk.yellow(__('notOwned')));
                return false;
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
    async getQuestInfo(url, isRetry = false) {
        const name = url.match(/steam\/quests\/(.+)/)?.[1];
        (0, tool_1.log)(`${(0, tool_1.time)()}${__('gettingSingleSteamQuestInfo', chalk.yellow(name || url))}`, false);
        const options = {
            url,
            method: 'GET',
            responseType: 'text',
            headers: {
                cookie: this.awaCookie,
                accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
                'accept-encoding': 'gzip, deflate, br',
                'accept-language': 'zh-CN,zh;q=0.9,en;q=0.8,en-GB;q=0.7,en-US;q=0.6',
                'user-agent': globalThis.userAgent,
                referer: 'https://www.alienwarearena.com/steam/quests'
            }
        };
        if (this.httpsAgent)
            options.httpsAgent = this.httpsAgent;
        return (0, tool_1.http)(options)
            .then((response) => {
            globalThis.secrets = [...new Set([...globalThis.secrets.split('|'), ...(response.headers['set-cookie'] || []).map((e) => e.split(';')[0].trim().split('=')[1]).filter((e) => e && e.length > 5)])].join('|');
            if (response.data.includes('You have completed this quest')) {
                (0, tool_1.log)(chalk.green(__('steamQuestCompleted')));
                return false;
            }
            if (response.data.includes('This quest requires that you own')) {
                if (name && !isRetry) {
                    (0, tool_1.log)(chalk.yellow(__('steamQuestRecheck')));
                    return this.awaCheckOwnedGames(name);
                }
                (0, tool_1.log)(chalk.yellow(__('steamQuestSkipped')));
                return false;
            }
            if (response.data.includes('Launch Game')) {
                (0, tool_1.log)(chalk.green(__('steamQuestStarted')));
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
    async startQuest(url) {
        (0, tool_1.log)(`${(0, tool_1.time)()}${__('startingSteamQuest', chalk.yellow(url))}`, false);
        const options = {
            url: url.replace('steam/quests', 'ajax/user/steam/quests/start'),
            method: 'GET',
            headers: {
                cookie: this.awaCookie,
                'user-agent': globalThis.userAgent,
                referer: url
            }
        };
        if (this.httpsAgent)
            options.httpsAgent = this.httpsAgent;
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
            (0, tool_1.log)(`${(0, tool_1.time)()}${__('checkingProgress', chalk.yellow(this.taskStatus[index].link))}`, false);
            const options = {
                url: this.taskStatus[index].link,
                method: 'GET',
                responseType: 'text',
                headers: {
                    cookie: this.awaCookie,
                    accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
                    'accept-encoding': 'gzip, deflate, br',
                    'accept-language': 'zh-CN,zh;q=0.9,en;q=0.8,en-GB;q=0.7,en-US;q=0.6',
                    'user-agent': globalThis.userAgent,
                    referer: 'https://www.alienwarearena.com/steam/quests'
                }
            };
            if (this.httpsAgent)
                options.httpsAgent = this.httpsAgent;
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
                    (0, tool_1.log)(chalk.red(__('noProgress')));
                    return false;
                }
                (0, tool_1.log)(chalk.red(__('noProgressBar')));
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
            (0, tool_1.log)((0, tool_1.time)() + chalk.yellow('Steam') + chalk.green(__('steamQuestFinished')));
            await this.resume();
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
        (0, tool_1.log)(`${(0, tool_1.time)()}${__('matchingGames', chalk.yellow('Steam'))}`, false);
        const options = {
            url: this.asfUrl,
            method: 'POST',
            headers: this.headers,
            data: `{"Command":"!owns ${this.botname} ${this.gamesInfo.map((e) => e.id).join(',')}"}`
        };
        if (this.httpsAgent)
            options.httpsAgent = this.httpsAgent;
        return (0, tool_1.http)(options)
            .then((response) => {
            globalThis.secrets = [...new Set([...globalThis.secrets.split('|'), ...(response.headers['set-cookie'] || []).map((e) => e.split(';')[0].trim().split('=')[1]).filter((e) => e && e.length > 5)])].join('|');
            if (response.status === 200) {
                if (response.data.Success === true && response.data.Message === 'OK' && response.data.Result) {
                    this.ownedGames = [...new Set(response.data.Result.split('\n').filter((e) => e.includes('|')).map((e) => e.trim().match(/app\/([\d]+)/)?.[1])
                            .filter((e) => e))];
                    this.maxArp = this.ownedGames.map((id) => this.gamesInfo.find((info) => info.id === id)?.arp || 0).reduce((acr, cur) => acr + cur);
                    this.maxPlayTimes = Math.max(...this.ownedGames.map((id) => this.gamesInfo.find((info) => info.id === id)?.time || 2));
                    this.taskStatus = this.ownedGames.map((id) => this.gamesInfo.find((info) => info.id === id)).filter((e) => e);
                    (0, tool_1.log)(chalk.green('OK'));
                    return true;
                }
                if (response.data.Message) {
                    (0, tool_1.log)(chalk.blue(response.data.Message));
                    return false;
                }
                (0, tool_1.log)(chalk.blue('Error'));
                (0, tool_1.log)(response.data);
                return false;
            }
            (0, tool_1.log)(chalk.red(`Error: ${response.status}`));
            return false;
        })
            .catch((error) => {
            (0, tool_1.log)(chalk.red('Error'));
            globalThis.secrets = [...new Set([...globalThis.secrets.split('|'), ...(error.response?.headers?.['set-cookie'] || []).map((e) => e.split(';')[0].trim().split('=')[1]).filter((e) => e && e.length > 5)])].join('|');
            (0, tool_1.log)(error);
            return false;
        });
    }
    async playGames() {
        if (!await this.getOwnedGames())
            return false;
        if (this.ownedGames.length === 0) {
            (0, tool_1.log)((0, tool_1.time)() + chalk.yellow(__('noGamesAlert')));
            this.status = 'stopped';
            return false;
        }
        (0, tool_1.log)(`${(0, tool_1.time)()}${__('usingASF', chalk.yellow('ASF'))}`, false);
        const options = {
            url: this.asfUrl,
            method: 'POST',
            headers: this.headers,
            data: `{"Command":"!play ${this.botname} ${this.ownedGames.join(',')}"}`
        };
        if (this.httpsAgent)
            options.httpsAgent = this.httpsAgent;
        const started = await (0, tool_1.http)(options)
            .then((response) => {
            globalThis.secrets = [...new Set([...globalThis.secrets.split('|'), ...(response.headers['set-cookie'] || []).map((e) => e.split(';')[0].trim().split('=')[1]).filter((e) => e && e.length > 5)])].join('|');
            if (response.status === 200) {
                if (response.data.Success === true && response.data.Message === 'OK' && response.data.Result) {
                    this.status = 'running';
                    (0, tool_1.log)(chalk.green('OK'));
                    return true;
                }
                if (response.data.Message) {
                    (0, tool_1.log)(chalk.blue(response.data.Message));
                    return false;
                }
                (0, tool_1.log)(chalk.blue('Error'));
                (0, tool_1.log)(response.data);
                return false;
            }
            (0, tool_1.log)(chalk.red(`Error: ${response.status}`));
            return false;
        })
            .catch((error) => {
            (0, tool_1.log)(chalk.red('Error'));
            globalThis.secrets = [...new Set([...globalThis.secrets.split('|'), ...(error.response?.headers?.['set-cookie'] || []).map((e) => e.split(';')[0].trim().split('=')[1]).filter((e) => e && e.length > 5)])].join('|');
            (0, tool_1.log)(error);
            return false;
        });
        if (!started)
            return false;
        await (0, tool_1.sleep)(10 * 60);
        return await this.checkStatus();
    }
    async resume() {
        if (this.status === 'stopped')
            return true;
        (0, tool_1.log)(`${(0, tool_1.time)()}${__('stoppingPlayingGames')}`, false);
        const options = {
            url: this.asfUrl,
            method: 'POST',
            headers: this.headers,
            data: `{"Command":"!resume ${this.botname}"}`
        };
        if (this.httpsAgent)
            options.httpsAgent = this.httpsAgent;
        return (0, tool_1.http)(options)
            .then((response) => {
            globalThis.secrets = [...new Set([...globalThis.secrets.split('|'), ...(response.headers['set-cookie'] || []).map((e) => e.split(';')[0].trim().split('=')[1]).filter((e) => e && e.length > 5)])].join('|');
            if (response.status === 200) {
                if (response.data.Success === true && response.data.Message === 'OK' && response.data.Result) {
                    this.status = 'stopped';
                    (0, tool_1.log)(chalk.green(response.data.Result));
                    return true;
                }
                if (response.data.Message) {
                    (0, tool_1.log)(chalk.blue(response.data.Message));
                    return false;
                }
                (0, tool_1.log)(chalk.blue('Error'));
                (0, tool_1.log)(response.data);
                return false;
            }
            (0, tool_1.log)(chalk.red(`Error: ${response.status}`));
            return false;
        })
            .catch((error) => {
            (0, tool_1.log)(chalk.red('Error'));
            globalThis.secrets = [...new Set([...globalThis.secrets.split('|'), ...(error.response?.headers?.['set-cookie'] || []).map((e) => e.split(';')[0].trim().split('=')[1]).filter((e) => e && e.length > 5)])].join('|');
            (0, tool_1.log)(error);
            return false;
        });
    }
}
exports.SteamQuestASF = SteamQuestASF;
