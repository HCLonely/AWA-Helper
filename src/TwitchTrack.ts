/*
 * @Author       : HCLonely
 * @Date         : 2025-07-18 09:14:26
 * @LastEditTime : 2025-08-26 15:37:44
 * @LastEditors  : HCLonely
 * @FilePath     : /AWA-Helper/src/TwitchTrack.ts
 * @Description  : Twitch 直播心跳
 */
/* global __, myAxiosConfig */
import { RawAxiosRequestHeaders } from 'axios';
import { load } from 'cheerio';
import * as chalk from 'chalk';
import { Logger, sleep, time, netError, http as axios, formatProxy, Cookie } from './tool';
import { EventEmitter } from 'events';
const emitter = new EventEmitter();

class TwitchTrack {
  channelId!: string | undefined;
  clientId!: string | undefined;
  jwt!: string | undefined;
  extensionID!: string | undefined;
  trackError = 0;
  trackTimes = 0;
  cookie: Cookie;
  httpsAgent!: myAxiosConfig['httpsAgent'];
  headers: RawAxiosRequestHeaders;
  complete = false;
  availableStreams!: Array<string>;
  availableStreamsInfo!: Array<string>;
  emitter = emitter;
  awaHeaders!: RawAxiosRequestHeaders;

  // eslint-disable-next-line no-undef
  constructor({ cookie, proxy }: { cookie: string, proxy?: proxy }) {
    this.cookie = new Cookie(cookie);
    this.headers = {
      Authorization: `OAuth ${this.cookie.get('auth-token')}`,
      'Content-Type': 'text/plain;charset=UTF-8',
      Host: 'gql.twitch.tv',
      Origin: 'https://www.twitch.tv',
      Referer: 'https://www.twitch.tv/',
      'User-Agent': globalThis.userAgent,
      'X-Device-Id': this.cookie.get('unique_id') as string
    };
    this.awaHeaders = globalThis.quest.headers;
    if (proxy?.enable?.includes('twitch') && proxy.host && proxy.port) {
      this.httpsAgent = formatProxy(proxy);
    }
  }

  async init(): Promise<boolean> {
    const logger = new Logger(`${time()}${__('initing', chalk.yellow('TwitchTrack'))}`, false);
    if (!this.cookie.get('unique_id')) {
      logger.log(chalk.red('Error: missing "unique_id" in twitchCookie!'));
      return false;
    }
    if (!this.cookie.get('auth-token')) {
      logger.log(chalk.red('Error: missing "auth-token" in twitchCookie!'));
      return false;
    }
    const options: myAxiosConfig = {
      url: 'https://www.twitch.tv/',
      method: 'GET',
      headers: {
        Host: 'www.twitch.tv',
        'User-Agent': globalThis.userAgent
      },
      Logger: logger
    };
    if (this.httpsAgent) options.httpsAgent = this.httpsAgent;

    const result = await axios(options)
      .then((response) => {
        globalThis.secrets = [...new Set([...globalThis.secrets, ...Object.values(Cookie.ToJson(response.headers?.['set-cookie']))])];
        if (response.status !== 200) {
          ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.red(`Error(1): ${response.status}`));
          return false;
        }
        const $ = load(response.data);
        const optionScript = $('script').filter((_, e) => !!$(e).html()?.includes('clientId'));
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
      })
      .catch((error) => {
        ((error.config as myAxiosConfig)?.Logger || logger).log(chalk.red('Error(0)') + netError(error));
        globalThis.secrets = [...new Set([...globalThis.secrets, ...Object.values(Cookie.ToJson(error.response?.headers?.['set-cookie']))])];
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
        globalThis.secrets = [...new Set([...globalThis.secrets, ...Object.values(Cookie.ToJson(response.headers?.['set-cookie']))])];
        const linkedExtension = response.data?.[0]?.data?.currentUser?.linkedExtensions?.find((e: any) => e.name === 'Arena Rewards Tracker');
        if (linkedExtension) {
          ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.green(__('authorized')));
          return true;
        }
        ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.red(__('notAuthorized')));
        return false;
      })
      .catch((error) => {
        ((error.config as myAxiosConfig)?.Logger || logger).log(chalk.red('Error(0)') + netError(error));
        globalThis.secrets = [...new Set([...globalThis.secrets, ...Object.values(Cookie.ToJson(error.response?.headers?.['set-cookie']))])];
        new Logger(error);
        return false;
      });
  }
  async getAvailableStreams(): Promise<boolean> {
    const logger = new Logger(`${time()}${__('gettingLiveInfo')}`, false);
    const options: myAxiosConfig = {
      url: `https://${globalThis.awaHost}/control-center`,
      method: 'GET',
      headers: {
        ...this.awaHeaders,
        accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9'
      },
      Logger: logger
    };
    if (this.httpsAgent) options.httpsAgent = this.httpsAgent;
    return axios(options)
      .then(async (response) => {
        globalThis.secrets = [...new Set([...globalThis.secrets, ...Object.values(Cookie.ToJson(response.headers?.['set-cookie']))])];
        if (response.status !== 200) {
          ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.red(`Net Error: ${response.status}`));
          return false;
        }
        const $ = load(response.data);
        this.availableStreams = $('div.quest-list__stream-thumbnail a[href]').toArray().map((e) => $(e).attr('href')
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
      })
      .catch((error) => {
        ((error.config as myAxiosConfig)?.Logger || logger).log(chalk.red('Error(0)') + netError(error));
        globalThis.secrets = [...new Set([...globalThis.secrets, ...Object.values(Cookie.ToJson(error.response?.headers?.['set-cookie']))])];
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
      headers: {
        Authorization: `OAuth ${this.cookie.get('auth-token')}`,
        'Client-Id': this.clientId,
        'User-Agent': globalThis.userAgent
      },
      data: `[{"operationName":"ActiveWatchParty","variables":{"channelLogin":"${this.availableStreams[index]}"},"extensions":{"persistedQuery":{"version":1,"sha256Hash":"4a8156c97b19e3a36e081cf6d6ddb5dbf9f9b02ae60e4d2ff26ed70aebc80a30"}}}]`,
      Logger: logger
    };
    if (this.httpsAgent) twitchOptions.httpsAgent = this.httpsAgent;
    return axios(twitchOptions)
      .then(async (response) => {
        globalThis.secrets = [...new Set([...globalThis.secrets, ...Object.values(Cookie.ToJson(response.headers?.['set-cookie']))])];
        const channelId = response.data?.[0]?.data?.user?.id;
        if (!channelId) {
          ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.red('Error(1)'));
          return await this.getChannelInfo(index + 1);
        }
        this.channelId = channelId;
        ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.green('OK'));
        return index;
      })
      .catch(async (error) => {
        logger.log(chalk.red('Error(0)') + netError(error));
        globalThis.secrets = [...new Set([...globalThis.secrets, ...Object.values(Cookie.ToJson(error.response?.headers?.['set-cookie']))])];
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
        globalThis.secrets = [...new Set([...globalThis.secrets, ...Object.values(Cookie.ToJson(response.headers?.['set-cookie']))])];
        const extensions = response.data?.[0]?.data?.user?.channel?.selfInstalledExtensions;
        if (!extensions?.length) {
          ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.red(`Error: ${__('noExt')}`));
          return await this.getExtInfo((returnedIndex as number) + 1);
        }
        const [ART_EXT] = extensions.filter((ext: any) => ext?.installation?.extension?.name === 'Arena Rewards Tracker');
        if (!ART_EXT) {
          ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.red(`Error(1): ${__('noExt')}`));
          return await this.getExtInfo((returnedIndex as number) + 1);
        }
        const { jwt } = ART_EXT.token;
        if (!jwt) {
          ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.red(`Error(2): ${__('getJwtFailed')}`));
          return await this.getExtInfo((returnedIndex as number) + 1);
        }
        this.jwt = jwt;
        ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.green('OK'));
        return true;
      })
      .catch(async (error) => {
        logger.log(chalk.red('Error(0)') + netError(error));
        globalThis.secrets = [...new Set([...globalThis.secrets, ...Object.values(Cookie.ToJson(error.response?.headers?.['set-cookie']))])];
        new Logger(error);
        return await this.getExtInfo((returnedIndex as number) + 1);
      });
  }
  async do(retried = false):Promise<boolean> {
    if (!(globalThis.quest.questInfo.watchTwitch?.[0] !== '15' || parseFloat(globalThis.quest.questInfo.watchTwitch?.[1] || '0') < globalThis.quest.additionalTwitchARP)) {
      return true;
    }
    if (!this.channelId || !this.jwt) {
      if (await this.getExtInfo() !== true) {
        await sleep(60 * 5);
        return this.do();
      }
    }
    const logger = new Logger(`${time()}${__('sendingOnlineTrack', chalk.yellow('Twitch'))}`, false);
    const options: myAxiosConfig = {
      url: `https://${globalThis.awaHost}/twitch/extensions/track`,
      method: 'GET',
      headers: {
        origin: `https://${this.extensionID}.ext-twitch.tv`,
        referer: `https://${this.extensionID}.ext-twitch.tv/`,
        'user-agent': globalThis.userAgent,
        'x-extension-channel': this.channelId,
        'x-extension-jwt': this.jwt,
        'User-Agent': globalThis.userAgent
      },
      Logger: logger
    };
    if (this.httpsAgent) options.httpsAgent = this.httpsAgent;
    const status = await axios(options)
      .then((response) => {
        globalThis.secrets = [...new Set([...globalThis.secrets, ...Object.values(Cookie.ToJson(response.headers?.['set-cookie']))])];
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
        ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.red('Error(1)'));
        new Logger(response.data?.message || response.statusText);
        this.trackError++;
        return false;
      })
      .catch((error) => {
        ((error.config as myAxiosConfig)?.Logger || logger).log(chalk.red('Error(0)') + netError(error));
        globalThis.secrets = [...new Set([...globalThis.secrets, ...Object.values(Cookie.ToJson(error.response?.headers?.['set-cookie']))])];
        new Logger(error);
        if (error.response?.status !== 403) {
          return false;
        }
        if (retried) {
          this.complete = true;
          return 'complete';
        }
        return 'Forbidden';
      });
    if ((['complete'] as Array<string|boolean>).includes(status)) {
      return true;
    }
    if (status === 'Forbidden') {
      if (await this.init() === true) {
        await sleep(60);
        this.channelId = undefined;
        this.clientId = undefined;
        this.jwt = undefined;
        this.extensionID = undefined;
        this.availableStreams = [];
        this.availableStreamsInfo = [];
        return this.do(true);
      }
      this.complete = true;
      return false;
    }
    if (status === 'offline') {
      this.channelId = '';
    }
    await sleep(60);
    return this.do();
  }
}

export { TwitchTrack };
