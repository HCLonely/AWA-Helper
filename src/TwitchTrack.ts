/* eslint-disable max-len */
/* global __, myAxiosConfig */
import { AxiosRequestHeaders } from 'axios';
import { load } from 'cheerio';
import * as chalk from 'chalk';
import { Logger, sleep, time, netError, http as axios, formatProxy } from './tool';

class TwitchTrack {
  channelId!: string;
  clientId!: string;
  jwt!: string;
  extensionID!: string;
  trackError = 0;
  trackTimes = 0;
  formatedCookie: {
    [name: string]: string
  } = {};
  cookie: string;
  httpsAgent!: myAxiosConfig['httpsAgent'];
  headers: AxiosRequestHeaders;
  complete = false;
  awaHost: string;
  availableStreams!: Array<string>;
  availableStreamsInfo!: Array<string>;

  // eslint-disable-next-line no-undef
  constructor({ awaHost, cookie, proxy }: { awaHost: string, cookie: string, proxy?: proxy }) {
    this.awaHost = awaHost || 'www.alienwarearena.com';
    this.cookie = cookie;
    cookie.split(';').map((e: string) => {
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
      this.httpsAgent = formatProxy(proxy);
    }
  }

  async init(): Promise<boolean> {
    const logger = new Logger(`${time()}${__('initing', chalk.yellow('TwitchTrack'))}`, false);
    const options: myAxiosConfig = {
      url: 'https://www.twitch.tv/',
      method: 'GET',
      headers: {
        Cookie: this.formatedCookie['auth-token'],
        Host: 'www.twitch.tv',
        'User-Agent': globalThis.userAgent
      },
      Logger: logger
    };
    if (this.httpsAgent) options.httpsAgent = this.httpsAgent;

    const result = await axios(options)
      .then((response) => {
        globalThis.secrets = [...new Set([...globalThis.secrets.split('|'), ...(response.headers['set-cookie'] || []).map((e) => e.split(';')[0].trim().split('=')[1]).filter((e: any) => e && e.length > 5)])].join('|');
        if (response.status === 200) {
          const $ = load(response.data);
          const optionScript = $('script').filter((i, e) => !!$(e).html()?.includes('clientId'));
          if (optionScript.length === 0) {
            ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.red('Error: optionScript not found!'));
            return false;
          }
          const clientId = optionScript.html()?.trim()?.match(/clientId="(.+?)"/)?.[1];
          if (!clientId) {
            ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.red('Error: clientId not found!'));
            return false;
          }
          this.clientId = clientId;
          ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.green('OK'));
          return true;
        }
        ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.red(`Error: ${response.status}`));
        return false;
      })
      .catch((error) => {
        ((error.config as myAxiosConfig)?.Logger || logger).log(chalk.red('Error') + netError(error));
        globalThis.secrets = [...new Set([...globalThis.secrets.split('|'), ...(error.response?.headers?.['set-cookie'] || []).map((e: string) => e.split(';')[0].trim().split('=')[1]).filter((e: any) => e && e.length > 5)])].join('|');
        new Logger(error);
        return false;
      });
    if (!result) return false;
    return await this.checkLinkedExt();
  }
  async checkLinkedExt(): Promise<boolean> {
    const logger = new Logger(`${time()}${__('checkAuthorization', chalk.yellow('Twitch'))}`, false);
    const options: myAxiosConfig = {
      url: 'https://gql.twitch.tv/gql',
      method: 'POST',
      headers: {
        ...this.headers,
        'Client-Id': this.clientId
      },
      data: '[{"operationName":"Settings_Connections_ExtensionConnectionsList","variables":{},"extensions":{"persistedQuery":{"version":1,"sha256Hash":"7de55e735212a90752672f9baf33016fe1c7f2b4bfdad94a6d8031a1633deaeb"}}}]',
      Logger: logger
    };
    if (this.httpsAgent) options.httpsAgent = this.httpsAgent;
    return axios(options)
      .then(async (response) => {
        globalThis.secrets = [...new Set([...globalThis.secrets.split('|'), ...(response.headers['set-cookie'] || []).map((e) => e.split(';')[0].trim().split('=')[1]).filter((e: any) => e && e.length > 5)])].join('|');
        const linkedExtension = response.data?.[0]?.data?.currentUser?.linkedExtensions?.find((e: any) => e.name === 'Arena Rewards Tracker');
        if (linkedExtension) {
          ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.green(__('authorized')));
          return true;
        }
        ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.red(__('notAuthorized')));
        return false;
      })
      .catch((error) => {
        ((error.config as myAxiosConfig)?.Logger || logger).log(chalk.red('Error') + netError(error));
        globalThis.secrets = [...new Set([...globalThis.secrets.split('|'), ...(error.response?.headers?.['set-cookie'] || []).map((e: string) => e.split(';')[0].trim().split('=')[1]).filter((e: any) => e && e.length > 5)])].join('|');
        new Logger(error);
        return false;
      });
  }
  async getAvailableStreams(): Promise<boolean> {
    const logger = new Logger(`${time()}${__('gettingLiveInfo')}`, false);
    const options: myAxiosConfig = {
      url: `https://${this.awaHost}/twitch/live`,
      method: 'GET',
      Logger: logger
    };
    if (this.httpsAgent) options.httpsAgent = this.httpsAgent;
    return axios(options)
      .then(async (response) => {
        globalThis.secrets = [...new Set([...globalThis.secrets.split('|'), ...(response.headers['set-cookie'] || []).map((e) => e.split(';')[0].trim().split('=')[1]).filter((e: any) => e && e.length > 5)])].join('|');
        if (response.status === 200) {
          const $ = load(response.data);
          this.availableStreams = $('div.media a[href]').toArray().map((e) => $(e).attr('href')
            ?.match(/www\.twitch\.tv\/(.+)/)?.[1])
            .filter((e) => e) as Array<string>;
          if (this.availableStreams.length === 0) {
            ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.blue(__('noLive')));
            new Logger(`${time()}${__('getLiveInfoAlert', chalk.green('10'))}`);
            await sleep(60 * 10);
            return await this.getAvailableStreams();
          }
          ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.green('OK'));
          return true;
        }
        ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.red(`Net Error: ${response.status}`));
        return false;
      })
      .catch((error) => {
        ((error.config as myAxiosConfig)?.Logger || logger).log(chalk.red('Error') + netError(error));
        globalThis.secrets = [...new Set([...globalThis.secrets.split('|'), ...(error.response?.headers?.['set-cookie'] || []).map((e: string) => e.split(';')[0].trim().split('=')[1]).filter((e: any) => e && e.length > 5)])].join('|');
        new Logger(error);
        return false;
      });
  }
  async getChannelInfo(index = 0): Promise<false | number> {
    if (index === 0 && !await this.getAvailableStreams()) return false;
    if (index >= this.availableStreams.length) return false;
    const logger = new Logger(`${time()}${__('gettingChannelInfo', chalk.yellow(this.availableStreams[index]))}`, false);
    const twitchOptions: myAxiosConfig = {
      url: 'https://gql.twitch.tv/gql',
      method: 'POST',
      headers: { Authorization: `OAuth ${this.formatedCookie['auth-token']}`, 'Client-Id': this.clientId },
      data: `[{"operationName":"ActiveWatchParty","variables":{"channelLogin":"${this.availableStreams[index]}"},"extensions":{"persistedQuery":{"version":1,"sha256Hash":"4a8156c97b19e3a36e081cf6d6ddb5dbf9f9b02ae60e4d2ff26ed70aebc80a30"}}}]`,
      Logger: logger
    };
    if (this.httpsAgent) twitchOptions.httpsAgent = this.httpsAgent;
    return axios(twitchOptions)
      .then(async (response) => {
        globalThis.secrets = [...new Set([...globalThis.secrets.split('|'), ...(response.headers['set-cookie'] || []).map((e) => e.split(';')[0].trim().split('=')[1]).filter((e: any) => e && e.length > 5)])].join('|');
        const channelId = response.data?.[0]?.data?.user?.id;
        if (!channelId) {
          ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.red('Error'));
          return await this.getChannelInfo(index + 1);
        }
        this.channelId = channelId;
        ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.green('OK'));
        return index;
      })
      .catch(async (error) => {
        logger.log(chalk.red('Error') + netError(error));
        globalThis.secrets = [...new Set([...globalThis.secrets.split('|'), ...(error.response?.headers?.['set-cookie'] || []).map((e: string) => e.split(';')[0].trim().split('=')[1]).filter((e: any) => e && e.length > 5)])].join('|');
        new Logger(error);
        return await this.getChannelInfo(index + 1);
      });
  }
  async getExtInfo(index = 0): Promise<boolean> {
    const returnedIndex = await this.getChannelInfo(index);
    if (returnedIndex === false) {
      return false;
    }
    if (index >= this.availableStreams.length) return false;
    const logger = new Logger(`${time()}${__('gettingExtInfo')}`, false);
    const options: myAxiosConfig = {
      url: 'https://gql.twitch.tv/gql',
      method: 'POST',
      headers: {
        ...this.headers,
        'Client-Id': this.clientId
      },
      data: `[{"operationName":"ExtensionsForChannel","variables":{"channelID":"${this.channelId}"},"extensions":{"persistedQuery":{"version":1,"sha256Hash":"37a5969f117f2f76bc8776a0b216799180c0ce722acb92505c794a9a4f9737e7"}}}]`,
      Logger: logger
    };
    if (this.httpsAgent) options.httpsAgent = this.httpsAgent;
    return axios(options)
      .then(async (response) => {
        globalThis.secrets = [...new Set([...globalThis.secrets.split('|'), ...(response.headers['set-cookie'] || []).map((e) => e.split(';')[0].trim().split('=')[1]).filter((e: any) => e && e.length > 5)])].join('|');
        const extensions = response.data?.[0]?.data?.user?.channel?.selfInstalledExtensions;
        if (!extensions?.length) {
          ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.red(`Error: ${__('noExt')}`));
          return await this.getExtInfo((returnedIndex as number) + 1);
        }
        const [ART_EXT] = extensions.filter((ext: any) => ext?.installation?.extension?.name === 'Arena Rewards Tracker');
        if (!ART_EXT) {
          ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.red(`Error: ${__('noExt')}`));
          return await this.getExtInfo((returnedIndex as number) + 1);
        }
        const { jwt } = ART_EXT.token;
        if (!jwt) {
          ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.red(`Error: ${__('getJwtFailed')}`));
          return await this.getExtInfo((returnedIndex as number) + 1);
        }
        this.jwt = jwt;
        ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.green('OK'));
        return true;
      })
      .catch(async (error) => {
        logger.log(chalk.red('Error') + netError(error));
        globalThis.secrets = [...new Set([...globalThis.secrets.split('|'), ...(error.response?.headers?.['set-cookie'] || []).map((e: string) => e.split(';')[0].trim().split('=')[1]).filter((e: any) => e && e.length > 5)])].join('|');
        new Logger(error);
        return await this.getExtInfo((returnedIndex as number) + 1);
      });
  }
  async sendTrack():Promise<void> {
    if (!this.channelId) {
      if (await this.getExtInfo() !== true) {
        await sleep(60 * 5);
        this.sendTrack();
        return;
      }
    }
    const logger = new Logger(`${time()}${__('sendingOnlineTrack', chalk.yellow('Twitch'))}`, false);
    const options: myAxiosConfig = {
      url: 'https://www.alienwarearena.com/twitch/extensions/track',
      method: 'GET',
      headers: {
        origin: `https://${this.extensionID}.ext-twitch.tv`,
        referer: `https://${this.extensionID}.ext-twitch.tv/`,
        'user-agent': globalThis.userAgent,
        'x-extension-channel': this.channelId,
        'x-extension-jwt': this.jwt
      },
      Logger: logger
    };
    if (this.httpsAgent) options.httpsAgent = this.httpsAgent;
    const status = await axios(options)
      .then((response) => {
        globalThis.secrets = [...new Set([...globalThis.secrets.split('|'), ...(response.headers['set-cookie'] || []).map((e) => e.split(';')[0].trim().split('=')[1]).filter((e: any) => e && e.length > 5)])].join('|');
        if (response.data.success) {
          ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.green('OK'));
          this.trackError = 0;
          this.trackTimes++;
          let returnText: boolean | string = true;
          switch (response.data.state) {
          case 'daily_cap_reached':
            this.complete = true;
            new Logger(time() + chalk.green(response.data.message || __('obtainedArp')));
            returnText = 'complete';
            break;
          case 'streamer_offline':
            new Logger(time() + chalk.blue(__('liveOffline', chalk.yellow(this.channelId))));
            returnText = 'offline';
            break;
          case 'streamer_online':
            break;
          default:
            break;
          }
          return returnText;
        }
        ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.red('Error'));
        new Logger(response.data?.message || response.statusText);
        this.trackError++;
        return false;
      })
      .catch((error) => {
        ((error.config as myAxiosConfig)?.Logger || logger).log(chalk.red('Error') + netError(error));
        globalThis.secrets = [...new Set([...globalThis.secrets.split('|'), ...(error.response?.headers?.['set-cookie'] || []).map((e: string) => e.split(';')[0].trim().split('=')[1]).filter((e: any) => e && e.length > 5)])].join('|');
        new Logger(error);
        return false;
      });
    if (status === 'complete') {
      return;
    }
    if (status === 'offline') {
      this.channelId = '';
    }
    await sleep(60);
    this.sendTrack();
  }
}

export { TwitchTrack };
