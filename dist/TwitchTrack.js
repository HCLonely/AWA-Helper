"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TwitchTrack = void 0;
/* eslint-disable max-len */
const axios_1 = require("axios");
const cheerio_1 = require("cheerio");
const chalk = require("chalk");
const tool_1 = require("./tool");
const tunnel = require("tunnel");
const socks_proxy_agent_1 = require("socks-proxy-agent");
class TwitchTrack {
    // eslint-disable-next-line no-undef
    constructor({ awaHost, cookie, proxy }) {
        this.trackError = 0;
        this.trackTimes = 0;
        this.formatedCookie = {};
        this.complete = false;
        this.awaHost = awaHost || 'www.alienwarearena.com';
        this.cookie = cookie;
        cookie.split(';').map((e) => {
            const [name, value] = e.split('=');
            this.formatedCookie[name.trim()] = value?.trim();
            return e;
        });
        this.headers = {
            Authorization: `OAuth ${this.formatedCookie['auth-token']}`,
            'Content-Type': 'text/plain;charset=UTF-8',
            Host: 'gql.twitch.tv',
            Origin: 'https://www.twitch.tv',
            Referer: 'https://www.twitch.tv/',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.4896.127 Safari/537.36 Edg/100.0.1185.44',
            'X-Device-Id': this.formatedCookie.unique_id
        };
        if (proxy?.enable?.includes('twitch') && proxy.host && proxy.port) {
            const proxyOptions = {
                host: proxy.host,
                port: proxy.port
            };
            if (proxy.protocol === 'socks') {
                proxyOptions.hostname = proxy.host;
                if (proxy.username && proxy.password) {
                    proxyOptions.userId = proxy.username;
                    proxyOptions.password = proxy.password;
                }
                this.httpsAgent = new socks_proxy_agent_1.SocksProxyAgent(proxyOptions);
            }
            else {
                if (proxy.username && proxy.password) {
                    proxyOptions.proxyAuth = `${proxy.username}:${proxy.password}`;
                }
                this.httpsAgent = tunnel.httpsOverHttp({
                    proxy: proxyOptions
                });
            }
        }
    }
    async init() {
        (0, tool_1.log)(`${(0, tool_1.time)()}正在初始化TwitchTrack...`, false);
        const options = {
            url: 'https://www.twitch.tv/',
            method: 'GET',
            headers: {
                Cookie: this.formatedCookie['auth-token'],
                Host: 'www.twitch.tv',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.4896.127 Safari/537.36 Edg/100.0.1185.44'
            }
        };
        if (this.httpsAgent)
            options.httpsAgent = this.httpsAgent;
        const result = await (0, axios_1.default)(options)
            .then((response) => {
            if (response.status === 200) {
                const $ = (0, cheerio_1.load)(response.data);
                const optionScript = $('script').filter((i, e) => !!$(e).html()?.includes('clientId'));
                if (optionScript.length === 0) {
                    (0, tool_1.log)(chalk.red('Error: optionScript not found!'));
                    return false;
                }
                const clientId = optionScript.html()?.trim()?.match(/clientId="(.+?)"/)?.[1];
                if (!clientId) {
                    (0, tool_1.log)(chalk.red('Error: clientId not found!'));
                    return false;
                }
                this.clientId = clientId;
                (0, tool_1.log)(chalk.green('OK'));
                return true;
            }
            (0, tool_1.log)(chalk.red(`Error: ${response.status}`));
            return false;
        })
            .catch((error) => {
            (0, tool_1.log)(chalk.red('Error') + (0, tool_1.netError)(error));
            console.error(error);
            return false;
        });
        if (!result)
            return false;
        return await this.checkLinkedExt();
    }
    async checkLinkedExt() {
        (0, tool_1.log)(`${(0, tool_1.time)()}正在检测是否授权${chalk.yellow('Twitch')}扩展...`, false);
        const options = {
            url: 'https://gql.twitch.tv/gql',
            method: 'POST',
            headers: {
                ...this.headers,
                'Client-Id': this.clientId
            },
            data: '[{"operationName":"Settings_Connections_ExtensionConnectionsList","variables":{},"extensions":{"persistedQuery":{"version":1,"sha256Hash":"7de55e735212a90752672f9baf33016fe1c7f2b4bfdad94a6d8031a1633deaeb"}}}]'
        };
        if (this.httpsAgent)
            options.httpsAgent = this.httpsAgent;
        return await (0, axios_1.default)(options)
            .then(async (response) => {
            const linkedExtension = response.data?.[0]?.data?.currentUser?.linkedExtensions?.find((e) => e.name === 'Arena Rewards Tracker');
            if (linkedExtension) {
                (0, tool_1.log)(chalk.green('已授权'));
                return true;
            }
            (0, tool_1.log)(chalk.red('未授权'));
            return false;
        })
            .catch((error) => {
            (0, tool_1.log)(chalk.red('Error') + (0, tool_1.netError)(error));
            console.error(error);
            return false;
        });
    }
    async getAvailableStreams() {
        (0, tool_1.log)(`${(0, tool_1.time)()}正在获取可用直播信息...`, false);
        const options = {
            url: `https://${this.awaHost}/twitch/live`,
            method: 'GET'
        };
        if (this.httpsAgent)
            options.httpsAgent = this.httpsAgent;
        return await (0, axios_1.default)(options)
            .then(async (response) => {
            if (response.status === 200) {
                const $ = (0, cheerio_1.load)(response.data);
                this.availableStreams = $('div.media a[href]').toArray().map((e) => $(e).attr('href')
                    ?.match(/www\.twitch\.tv\/(.+)/)?.[1])
                    .filter((e) => e);
                if (this.availableStreams.length === 0) {
                    (0, tool_1.log)(chalk.blue('当前没有可用的直播！'));
                    (0, tool_1.log)((0, tool_1.time)() + chalk.yellow('10 分钟后再次获取可用直播信息'));
                    await (0, tool_1.sleep)(60 * 10);
                    return await this.getAvailableStreams();
                }
                (0, tool_1.log)(chalk.green('OK'));
                return true;
            }
            (0, tool_1.log)(chalk.red(`Net Error: ${response.status}`));
            return false;
        })
            .catch((error) => {
            (0, tool_1.log)(chalk.red('Error') + (0, tool_1.netError)(error));
            console.error(error);
            return false;
        });
    }
    async getChannelInfo(index = 0) {
        if (index === 0 && !await this.getAvailableStreams())
            return false;
        if (index >= this.availableStreams.length)
            return false;
        const twitchOptions = {
            url: 'https://gql.twitch.tv/gql',
            method: 'POST',
            headers: { Authorization: `OAuth ${this.formatedCookie['auth-token']}`, 'Client-Id': this.clientId },
            data: `[{"operationName":"ActiveWatchParty","variables":{"channelLogin":"${this.availableStreams[index]}"},"extensions":{"persistedQuery":{"version":1,"sha256Hash":"4a8156c97b19e3a36e081cf6d6ddb5dbf9f9b02ae60e4d2ff26ed70aebc80a30"}}}]`
        };
        if (this.httpsAgent)
            twitchOptions.httpsAgent = this.httpsAgent;
        (0, tool_1.log)(`${(0, tool_1.time)()}正在获取直播频道[${chalk.yellow(this.availableStreams[index])}]信息...`, false);
        return await (0, axios_1.default)(twitchOptions)
            .then(async (response) => {
            const channelId = response.data?.[0]?.data?.user?.id;
            if (!channelId) {
                (0, tool_1.log)(chalk.red('Error'));
                return await this.getChannelInfo(index + 1);
            }
            this.channelId = channelId;
            (0, tool_1.log)(chalk.green('OK'));
            return index;
        })
            .catch(async (error) => {
            (0, tool_1.log)(chalk.red('Error') + (0, tool_1.netError)(error));
            console.error(error);
            return await this.getChannelInfo(index + 1);
        });
    }
    async getExtInfo(index = 0) {
        const returnedIndex = await this.getChannelInfo(index);
        if (returnedIndex === false) {
            return false;
        }
        if (index >= this.availableStreams.length)
            return false;
        (0, tool_1.log)(`${(0, tool_1.time)()}正在获取ART扩展信息...`, false);
        const options = {
            url: 'https://gql.twitch.tv/gql',
            method: 'POST',
            headers: {
                ...this.headers,
                'Client-Id': this.clientId
            },
            data: `[{"operationName":"ExtensionsForChannel","variables":{"channelID":"${this.channelId}"},"extensions":{"persistedQuery":{"version":1,"sha256Hash":"37a5969f117f2f76bc8776a0b216799180c0ce722acb92505c794a9a4f9737e7"}}}]`
        };
        if (this.httpsAgent)
            options.httpsAgent = this.httpsAgent;
        return await (0, axios_1.default)(options)
            .then(async (response) => {
            const extensions = response.data?.[0]?.data?.user?.channel?.selfInstalledExtensions;
            if (!extensions?.length) {
                (0, tool_1.log)(chalk.red('Error: 在此频道没有找到扩展！'));
                return await this.getExtInfo(returnedIndex + 1);
            }
            const [ART_EXT] = extensions.filter((ext) => ext?.installation?.extension?.name === 'Arena Rewards Tracker');
            if (!ART_EXT) {
                (0, tool_1.log)(chalk.red('Error: 在此频道没有找到ART扩展！'));
                return await this.getExtInfo(returnedIndex + 1);
            }
            const { jwt } = ART_EXT.token;
            if (!ART_EXT) {
                (0, tool_1.log)(chalk.red('Error: 获取jwt失败！'));
                return await this.getExtInfo(returnedIndex + 1);
            }
            this.jwt = jwt;
            (0, tool_1.log)(chalk.green('OK'));
            return true;
        })
            .catch(async (error) => {
            (0, tool_1.log)(chalk.red('Error') + (0, tool_1.netError)(error));
            console.error(error);
            return await this.getExtInfo(returnedIndex + 1);
        });
    }
    async sendTrack() {
        if (!this.channelId) {
            if (await this.getExtInfo() !== true)
                return;
        }
        (0, tool_1.log)(`${(0, tool_1.time)()}正在发送${chalk.yellow('Twitch')}在线心跳...`, false);
        const options = {
            url: 'https://www.alienwarearena.com/twitch/extensions/track',
            method: 'GET',
            headers: {
                origin: `https://${this.extensionID}.ext-twitch.tv`,
                referer: `https://${this.extensionID}.ext-twitch.tv/`,
                'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.4896.127 Safari/537.36 Edg/100.0.1185.44',
                'x-extension-channel': this.channelId,
                'x-extension-jwt': this.jwt
            }
        };
        if (this.httpsAgent)
            options.httpsAgent = this.httpsAgent;
        const status = await (0, axios_1.default)(options)
            .then((response) => {
            if (response.data.success) {
                (0, tool_1.log)(chalk.green('OK'));
                this.trackError = 0;
                this.trackTimes++;
                let returnText = true;
                switch (response.data.state) {
                    case 'daily_cap_reached':
                        this.complete = true;
                        (0, tool_1.log)((0, tool_1.time)() + chalk.green(response.data.message || '今日ARP已获取！'));
                        returnText = 'complete';
                        break;
                    case 'streamer_offline':
                        (0, tool_1.log)((0, tool_1.time)() + chalk.blue(`此直播间[${chalk.yellow(this.channelId)}]已停止直播！`));
                        returnText = 'offline';
                        break;
                    case 'streamer_online':
                        break;
                    default:
                        break;
                }
                return returnText;
            }
            (0, tool_1.log)(chalk.red('Error'));
            (0, tool_1.log)(response.data?.message || response.statusText);
            this.trackError++;
            return false;
        })
            .catch((error) => {
            (0, tool_1.log)(chalk.red('Error') + (0, tool_1.netError)(error));
            console.error(error);
            return false;
        });
        if (status === 'complete') {
            return;
        }
        if (status === 'offline') {
            this.channelId = '';
        }
        await (0, tool_1.sleep)(60);
        this.sendTrack();
    }
}
exports.TwitchTrack = TwitchTrack;
