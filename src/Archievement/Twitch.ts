/*
 * @Author       : HCLonely
 * @Date         : 2026-01-08 16:59:59
 * @LastEditTime : 2026-01-21 14:47:03
 * @LastEditors  : HCLonely
 * @FilePath     : /AWA-Helper/src/Archievement/Twitch.ts
 * @Description  : Twitch Track
 */

/* global __, myAxiosConfig, proxy */
import { RawAxiosRequestHeaders } from 'axios';
import { load } from 'cheerio';
import * as chalk from 'chalk';
import { Logger, sleep, time, netError, http as axios, formatProxy, Cookie } from './tool';

class Twitch {
  clientId!: string | undefined;
  cookie: Cookie;
  httpsAgent!: myAxiosConfig['httpsAgent'];
  headers: RawAxiosRequestHeaders;
  private isTracking = true;

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
        new Logger(error);
        return false;
      });
  }

  async getChannelInfo(streamerNames: string[]): Promise<{ channelId?: string, jwt?: string, extensionID?: string }> {
    if (streamerNames.length === 0) {
      // addLog('没有可用的频道列表', TaskStatus.WARNING);
      new Logger(`${time()}${__('noLive')}`);
      return {};
    }

    for (let i = 0; i < streamerNames.length; i++) {
      const streamerName = streamerNames[i];

      try {
        const { channelId, jwt, extensionID } = await this.getSingleChannelInfo(streamerName);
        if (channelId && jwt) {
          // addLog(`获取频道信息成功: ${streamerName} (ID: ${channelId})`, TaskStatus.SUCCESS);
          return { channelId, jwt, extensionID };
        }
      } catch (error) {
        new Logger(`${time()}${__('getChannelFailed', chalk.yellow(streamerName))}`);
        continue;
      }
    }

    new Logger(`${time()}${__('allChannelsFailed')}`);
    return {};
  }

  async getSingleChannelInfo(streamerName: String): Promise<{ channelId?: string, jwt?: string, extensionID?: string }> {
    const logger = new Logger(`${time()}${__('gettingChannelInfo', chalk.yellow(streamerName))}`, false);
    const twitchOptions: myAxiosConfig = {
      url: 'https://gql.twitch.tv/gql',
      method: 'POST',
      headers: {
        Authorization: `OAuth ${this.cookie.get('auth-token')}`,
        'Client-Id': this.clientId,
        'User-Agent': globalThis.userAgent
      },
      data: `[{"operationName":"ActiveWatchParty","variables":{"channelLogin":"${streamerName}"},"extensions":{"persistedQuery":{"version":1,"sha256Hash":"4a8156c97b19e3a36e081cf6d6ddb5dbf9f9b02ae60e4d2ff26ed70aebc80a30"}}}]`,
      Logger: logger
    };
    if (this.httpsAgent) twitchOptions.httpsAgent = this.httpsAgent;
    return axios(twitchOptions)
      .then(async (response) => {
        const channelId = response.data?.[0]?.data?.user?.id;
        if (!channelId) {
          ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.red('Error(1)'));
          return {};
        }
        ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.green('OK'));
        // this.channelId = channelId;
        const { extensionID, jwt } = await this.getExtInfo(channelId);
        if (!jwt) {
          // ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.red('Error(2)'));
          return {};
        }
        // ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.green('OK'));
        return { channelId, jwt, extensionID };
      })
      .catch(async (error) => {
        logger.log(chalk.red('Error(0)') + netError(error));
        new Logger(error);
        return {};
      });
  }
  async getExtInfo(channelId: string): Promise<{ extensionID?: string, jwt?: string }> {
    const logger = new Logger(`${time()}${__('gettingExtInfo')}`, false);
    const options: myAxiosConfig = {
      url: 'https://gql.twitch.tv/gql',
      method: 'POST',
      headers: {
        ...this.headers,
        'Client-Id': this.clientId
      },
      data: `[{"operationName":"ExtensionsForChannel","variables":{"channelID":"${channelId}"},"extensions":{"persistedQuery":{"version":1,"sha256Hash":"d52085e5b03d1fc3534aa49de8f5128b2ee0f4e700f79bf3875dcb1c90947ac3"}}}]`,
      Logger: logger
    };
    if (this.httpsAgent) options.httpsAgent = this.httpsAgent;
    return axios(options)
      .then(async (response) => {
        // console.log(JSON.stringify(response.data, null, 2));
        const extensions = response.data?.[0]?.data?.user?.channel?.selfInstalledExtensions;
        if (!extensions?.length) {
          ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.red(`Error: ${__('noExt')}`));
          return {};
        }
        const [ART_EXT] = extensions.filter((ext: any) => ext?.installation?.extension?.name === 'Arena Rewards Tracker');
        if (!ART_EXT) {
          ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.red(`Error(1): ${__('noExt')}`));
          return {};
        }
        const { extensionID, jwt } = ART_EXT.token as { extensionID?: string, jwt: string };
        if (!jwt) {
          ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.red(`Error(2): ${__('getJwtFailed')}`));
          return {};
        }
        // this.jwt = jwt;
        // this.extensionID = extensionID;
        ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.green('OK'));
        return { extensionID, jwt };
      })
      .catch(async (error) => {
        logger.log(chalk.red('Error(0)') + netError(error));
        new Logger(error);
        return {};
      });
  }
  async sendTrack({ channelId, jwt, extensionID }: { channelId: string, jwt: string, extensionID?: string }): Promise<boolean> {
    const logger = new Logger(`${time()}${__('sendingOnlineTrack', chalk.yellow('Twitch'))}`, false);
    const options: myAxiosConfig = {
      url: `https://${globalThis.awaHost}/twitch/extensions/track`,
      method: 'GET',
      headers: {
        origin: `https://${extensionID}.ext-twitch.tv`,
        referer: `https://${extensionID}.ext-twitch.tv/`,
        'user-agent': globalThis.userAgent,
        'x-extension-channel': channelId,
        'x-extension-jwt': jwt,
        'User-Agent': globalThis.userAgent
      },
      Logger: logger
    };
    if (this.httpsAgent) options.httpsAgent = this.httpsAgent;
    const status = await axios(options)
      .then((response) => {
        if (response.data.success) {
          ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.green('OK'));
          let returnText: boolean | string = true;
          switch (response.data.state) {
            case 'daily_cap_reached':
            case 'streamer_online':
              break;
            case 'streamer_offline':
              new Logger(time() + chalk.blue(__('liveOffline', chalk.yellow(channelId))));
              returnText = false;
              break;
            case 'no_channel_found':
              new Logger(time() + chalk.blue(__('noChannelFound', chalk.yellow(channelId))));
              returnText = false;
              break;
            default:
              new Logger(time() + chalk.red(__('unknownState', response.data.state)));
              break;
          }
          if (!returnText) {
            return false;
          }

          return true;
        }
        ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.red('Error(1)'));
        new Logger(response.data?.message || response.statusText);
        return false;
      })
      .catch((error) => {
        ((error.config as myAxiosConfig)?.Logger || logger).log(chalk.red('Error(0)') + netError(error));
        new Logger(error);
        return false;
      });

    if (!status || !this.isTracking) {
      if (!this.isTracking) {
        new Logger(`${time()}${chalk.yellow('Twitch tracking stopped')}`);
        return false;
      }
      throw new Error('Twitch Track Failed');
    }

    await sleep(60);

    // Check again if tracking should continue before recursing
    if (!this.isTracking) {
      new Logger(`${time()}${chalk.yellow('Twitch tracking stopped')}`);
      return false;
    }

    return this.sendTrack({ channelId, jwt, extensionID });
  }

  destroy(): void {
    // Stop tracking first
    this.isTracking = false;

    // Clear all properties to release memory
    this.clientId = undefined;

    // Clear objects and references
    if (this.cookie) {
      this.cookie = null as any;
    }
    if (this.headers) {
      this.headers = {} as RawAxiosRequestHeaders;
    }
    if (this.httpsAgent) {
      this.httpsAgent = undefined;
    }
  }
}

export { Twitch };
