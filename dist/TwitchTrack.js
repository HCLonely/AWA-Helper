"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TwitchTrack = void 0;
const cheerio_1 = require("cheerio");
const chalk = require("chalk");
const tool_1 = require("./tool");
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
            'User-Agent': globalThis.userAgent,
            'X-Device-Id': this.formatedCookie.unique_id
        };
        if (proxy?.enable?.includes('twitch') && proxy.host && proxy.port) {
            this.httpsAgent = (0, tool_1.formatProxy)(proxy);
        }
    }
    async init() {
        (0, tool_1.log)(`${(0, tool_1.time)()}${__('initing', chalk.yellow('TwitchTrack'))}`, false);
        const options = {
            url: 'https://www.twitch.tv/',
            method: 'GET',
            headers: {
                Cookie: this.formatedCookie['auth-token'],
                Host: 'www.twitch.tv',
                'User-Agent': globalThis.userAgent
            }
        };
        if (this.httpsAgent)
            options.httpsAgent = this.httpsAgent;
        const result = await (0, tool_1.http)(options)
            .then((response) => {
            globalThis.secrets = [...new Set([...globalThis.secrets.split('|'), ...(response.headers['set-cookie'] || []).map((e) => e.split(';')[0].trim().split('=')[1]).filter((e) => e && e.length > 5)])].join('|');
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
            globalThis.secrets = [...new Set([...globalThis.secrets.split('|'), ...(error.response?.headers?.['set-cookie'] || []).map((e) => e.split(';')[0].trim().split('=')[1]).filter((e) => e && e.length > 5)])].join('|');
            (0, tool_1.log)(error);
            return false;
        });
        if (!result)
            return false;
        return await this.checkLinkedExt();
    }
    async checkLinkedExt() {
        (0, tool_1.log)(`${(0, tool_1.time)()}${__('checkAuthorization', chalk.yellow('Twitch'))}`, false);
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
        return (0, tool_1.http)(options)
            .then(async (response) => {
            globalThis.secrets = [...new Set([...globalThis.secrets.split('|'), ...(response.headers['set-cookie'] || []).map((e) => e.split(';')[0].trim().split('=')[1]).filter((e) => e && e.length > 5)])].join('|');
            const linkedExtension = response.data?.[0]?.data?.currentUser?.linkedExtensions?.find((e) => e.name === 'Arena Rewards Tracker');
            if (linkedExtension) {
                (0, tool_1.log)(chalk.green(__('authorized')));
                return true;
            }
            (0, tool_1.log)(chalk.red(__('notAuthorized')));
            return false;
        })
            .catch((error) => {
            (0, tool_1.log)(chalk.red('Error') + (0, tool_1.netError)(error));
            globalThis.secrets = [...new Set([...globalThis.secrets.split('|'), ...(error.response?.headers?.['set-cookie'] || []).map((e) => e.split(';')[0].trim().split('=')[1]).filter((e) => e && e.length > 5)])].join('|');
            (0, tool_1.log)(error);
            return false;
        });
    }
    async getAvailableStreams() {
        (0, tool_1.log)(`${(0, tool_1.time)()}${__('gettingLiveInfo')}`, false);
        const options = {
            url: `https://${this.awaHost}/twitch/live`,
            method: 'GET'
        };
        if (this.httpsAgent)
            options.httpsAgent = this.httpsAgent;
        return (0, tool_1.http)(options)
            .then(async (response) => {
            globalThis.secrets = [...new Set([...globalThis.secrets.split('|'), ...(response.headers['set-cookie'] || []).map((e) => e.split(';')[0].trim().split('=')[1]).filter((e) => e && e.length > 5)])].join('|');
            if (response.status === 200) {
                const $ = (0, cheerio_1.load)(response.data);
                this.availableStreams = $('div.media a[href]').toArray().map((e) => $(e).attr('href')
                    ?.match(/www\.twitch\.tv\/(.+)/)?.[1])
                    .filter((e) => e);
                if (this.availableStreams.length === 0) {
                    (0, tool_1.log)(chalk.blue(__('noLive')));
                    (0, tool_1.log)(`${(0, tool_1.time)()}${__('getLiveInfoAlert', chalk.green('10'))}`);
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
            globalThis.secrets = [...new Set([...globalThis.secrets.split('|'), ...(error.response?.headers?.['set-cookie'] || []).map((e) => e.split(';')[0].trim().split('=')[1]).filter((e) => e && e.length > 5)])].join('|');
            (0, tool_1.log)(error);
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
        (0, tool_1.log)(`${(0, tool_1.time)()}${__('gettingChannelInfo', chalk.yellow(this.availableStreams[index]))}`, false);
        return (0, tool_1.http)(twitchOptions)
            .then(async (response) => {
            globalThis.secrets = [...new Set([...globalThis.secrets.split('|'), ...(response.headers['set-cookie'] || []).map((e) => e.split(';')[0].trim().split('=')[1]).filter((e) => e && e.length > 5)])].join('|');
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
            globalThis.secrets = [...new Set([...globalThis.secrets.split('|'), ...(error.response?.headers?.['set-cookie'] || []).map((e) => e.split(';')[0].trim().split('=')[1]).filter((e) => e && e.length > 5)])].join('|');
            (0, tool_1.log)(error);
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
        (0, tool_1.log)(`${(0, tool_1.time)()}${__('gettingExtInfo')}`, false);
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
        return (0, tool_1.http)(options)
            .then(async (response) => {
            globalThis.secrets = [...new Set([...globalThis.secrets.split('|'), ...(response.headers['set-cookie'] || []).map((e) => e.split(';')[0].trim().split('=')[1]).filter((e) => e && e.length > 5)])].join('|');
            const extensions = response.data?.[0]?.data?.user?.channel?.selfInstalledExtensions;
            if (!extensions?.length) {
                (0, tool_1.log)(chalk.red(`Error: ${__('noExt')}`));
                return await this.getExtInfo(returnedIndex + 1);
            }
            const [ART_EXT] = extensions.filter((ext) => ext?.installation?.extension?.name === 'Arena Rewards Tracker');
            if (!ART_EXT) {
                (0, tool_1.log)(chalk.red(`Error: ${__('noExt')}`));
                return await this.getExtInfo(returnedIndex + 1);
            }
            const { jwt } = ART_EXT.token;
            if (!ART_EXT) {
                (0, tool_1.log)(chalk.red(`Error: ${__('getJwtFailed')}`));
                return await this.getExtInfo(returnedIndex + 1);
            }
            this.jwt = jwt;
            (0, tool_1.log)(chalk.green('OK'));
            return true;
        })
            .catch(async (error) => {
            (0, tool_1.log)(chalk.red('Error') + (0, tool_1.netError)(error));
            globalThis.secrets = [...new Set([...globalThis.secrets.split('|'), ...(error.response?.headers?.['set-cookie'] || []).map((e) => e.split(';')[0].trim().split('=')[1]).filter((e) => e && e.length > 5)])].join('|');
            (0, tool_1.log)(error);
            return await this.getExtInfo(returnedIndex + 1);
        });
    }
    async sendTrack() {
        if (!this.channelId) {
            if (await this.getExtInfo() !== true)
                return;
        }
        (0, tool_1.log)(`${(0, tool_1.time)()}${__('sendingOnlineTrack', chalk.yellow('Twitch'))}`, false);
        const options = {
            url: 'https://www.alienwarearena.com/twitch/extensions/track',
            method: 'GET',
            headers: {
                origin: `https://${this.extensionID}.ext-twitch.tv`,
                referer: `https://${this.extensionID}.ext-twitch.tv/`,
                'user-agent': globalThis.userAgent,
                'x-extension-channel': this.channelId,
                'x-extension-jwt': this.jwt
            }
        };
        if (this.httpsAgent)
            options.httpsAgent = this.httpsAgent;
        const status = await (0, tool_1.http)(options)
            .then((response) => {
            globalThis.secrets = [...new Set([...globalThis.secrets.split('|'), ...(response.headers['set-cookie'] || []).map((e) => e.split(';')[0].trim().split('=')[1]).filter((e) => e && e.length > 5)])].join('|');
            if (response.data.success) {
                (0, tool_1.log)(chalk.green('OK'));
                this.trackError = 0;
                this.trackTimes++;
                let returnText = true;
                switch (response.data.state) {
                    case 'daily_cap_reached':
                        this.complete = true;
                        (0, tool_1.log)((0, tool_1.time)() + chalk.green(response.data.message || __('obtainedArp')));
                        returnText = 'complete';
                        break;
                    case 'streamer_offline':
                        (0, tool_1.log)((0, tool_1.time)() + chalk.blue(__('liveOffline', chalk.yellow(this.channelId))));
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
            globalThis.secrets = [...new Set([...globalThis.secrets.split('|'), ...(error.response?.headers?.['set-cookie'] || []).map((e) => e.split(';')[0].trim().split('=')[1]).filter((e) => e && e.length > 5)])].join('|');
            (0, tool_1.log)(error);
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
