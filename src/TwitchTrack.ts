/* eslint-disable max-len */
import axios, { AxiosRequestConfig, AxiosRequestHeaders } from 'axios';
import { load } from 'cheerio';
import * as chalk from 'chalk';
import { log, sleep, time } from './tool';
import * as tunnel from 'tunnel';
import { Agent } from 'http';

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
  httpsAgent!: Agent;
  headers: AxiosRequestHeaders;
  complete = false;

  // eslint-disable-next-line no-undef
  constructor(cookie: string, proxy?: proxy) {
    cookie.split(';').map((e: string) => {
      const [name, value] = e.split('=');
      this.formatedCookie[name] = value;
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
    if (proxy?.enable.includes('twitch') && proxy.host && proxy.port) {
      this.httpsAgent = tunnel.httpsOverHttp({
        proxy: {
          host: proxy.host,
          port: proxy.port
        }
      });
    }
  }

  init(): Promise<boolean> {
    log(`${time()}正在初始化TwitchTrack...`, false);
    const options: AxiosRequestConfig = {
      url: 'https://www.twitch.tv/',
      method: 'GET',
      headers: {
        Cookie: this.formatedCookie['auth-token'],
        Host: 'www.twitch.tv',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.4896.127 Safari/537.36 Edg/100.0.1185.44'
      }
    };
    if (this.httpsAgent) options.httpsAgent = this.httpsAgent;

    return axios(options)
      .then((response) => {
        if (response.status === 200) {
          const $ = load(response.data);
          const optionScript = $('script').filter((i, e) => !!$(e).html()?.includes('clientId'));
          if (optionScript.length === 0) {
            log(chalk.red('Error: optionScript not found!'));
            return false;
          }
          const clientId = optionScript.html()?.trim()?.match(/clientId="(.+?)"/)?.[1];
          if (!clientId) {
            log(chalk.red('Error: clientId not found!'));
            return false;
          }
          this.clientId = clientId;
          log(chalk.green('OK'));
          return true;
        }
        log(chalk.red(`Error: ${response.status}`));
        return false;
      })
      .catch((error) => {
        log(chalk.red('Error'));
        console.error(error);
        return false;
      });
  }
  async getAvailableStreams(): Promise<false | undefined | string> {
    log(`${time()}正在获取可用直播信息...`, false);
    const options: AxiosRequestConfig = {
      url: 'https://www.alienwarearena.com/twitch/live',
      method: 'GET'
    };
    if (this.httpsAgent) options.httpsAgent = this.httpsAgent;
    return await axios(options)
      .then(async (response) => {
        if (response.status === 200) {
          const $ = load(response.data);
          if ($('div.media a').length === 0) {
            log(chalk.blue('当前没有可用的直播！'));
            log(time() + chalk.yellow('10 分钟后再次获取可用直播信息'));
            await sleep(60 * 10);
            return await this.getAvailableStreams();
          }
          log(chalk.green('OK'));
          return $('div.media a').eq(0).attr('href')
            ?.match(/www\.twitch\.tv\/(.+)/)?.[1];
        }
        log(chalk.red(`Net Error: ${response.status}`));
        return false;
      })
      .catch((error) => {
        log(chalk.red('Error'));
        console.error(error);
        return false;
      });
  }
  async getChannelInfo(): Promise<boolean> {
    const liverName = await this.getAvailableStreams();
    if (!liverName) return false;
    const twitchOptions: AxiosRequestConfig = {
      url: 'https://gql.twitch.tv/gql',
      method: 'POST',
      headers: { Authorization: `OAuth ${this.formatedCookie['auth-token']}`, 'Client-Id': this.clientId },
      data: `[{"operationName":"ActiveWatchParty","variables":{"channelLogin":"${liverName}"},"extensions":{"persistedQuery":{"version":1,"sha256Hash":"4a8156c97b19e3a36e081cf6d6ddb5dbf9f9b02ae60e4d2ff26ed70aebc80a30"}}}]`
    };
    if (this.httpsAgent) twitchOptions.httpsAgent = this.httpsAgent;
    log(`${time()}正在获取直播频道[${chalk.yellow(liverName)}]信息...`, false);
    return await axios(twitchOptions)
      .then((response) => {
        const channelId = response.data?.[0]?.data?.user?.id;
        if (!channelId) {
          log(chalk.red('Error'));
          return false;
        }
        this.channelId = channelId;
        log(chalk.green('OK'));
        return true;
      })
      .catch((error) => {
        log(chalk.red('Error'));
        console.error(error);
        return false;
      });
  }
  getExtInfo(): Promise<boolean> {
    log(`${time()}正在获取ART扩展信息...`, false);
    const options: AxiosRequestConfig = {
      url: 'https://gql.twitch.tv/gql',
      method: 'POST',
      headers: {
        ...this.headers,
        'Client-Id': this.clientId
      },
      data: `[{"operationName":"ExtensionsForChannel","variables":{"channelID":"${this.channelId}"},"extensions":{"persistedQuery":{"version":1,"sha256Hash":"37a5969f117f2f76bc8776a0b216799180c0ce722acb92505c794a9a4f9737e7"}}}]`
    };
    if (this.httpsAgent) options.httpsAgent = this.httpsAgent;
    return axios(options)
      .then((response) => {
        const extensions = response.data?.[0]?.data?.user?.channel?.selfInstalledExtensions;
        if (!extensions?.length) {
          log(chalk.red('Error: 在此频道没有找到扩展！'));
          return false;
        }
        const [ART_EXT] = extensions.filter((ext: any) => ext?.installation?.extension?.name === 'Arena Rewards Tracker');
        if (!ART_EXT) {
          log(chalk.red('Error: 在此频道没有找到ART扩展！'));
          return false;
        }
        const { jwt } = ART_EXT.token;
        if (!ART_EXT) {
          log(chalk.red('Error: 获取jwt失败！'));
          return false;
        }
        this.jwt = jwt;
        log(chalk.green('OK'));
        return true;
      })
      .catch((error) => {
        log(chalk.red('Error'));
        console.error(error);
        return false;
      });
  }
  async sendTrack():Promise<void> {
    if (!this.channelId) {
      if (await this.getChannelInfo() !== true) return;
      if (await this.getExtInfo() !== true) return;
    }
    log(`${time()}正在发送${chalk.yellow('Twitch')}在线心跳...`, false);
    const options: AxiosRequestConfig = {
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
    if (this.httpsAgent) options.httpsAgent = this.httpsAgent;
    const status = await axios(options)
      .then((response) => {
        if (response.data.success) {
          log(chalk.green('OK'));
          this.trackError = 0;
          this.trackTimes++;
          let returnText: boolean | string = true;
          switch (response.data.state) {
          case 'daily_cap_reached':
            this.complete = true;
            log(time() + chalk.green(response.data.message || '今日ARP已获取！'));
            returnText = 'complete';
            break;
          case 'streamer_offline':
            log(time() + chalk.blue(`此直播间[${chalk.yellow(this.channelId)}]已停止直播！`));
            returnText = 'offline';
            break;
          case 'streamer_online':
            break;
          default:
            break;
          }
          return returnText;
        }
        log(chalk.red('Error'));
        log(response.data?.message || response.statusText);
        this.trackError++;
        return false;
      })
      .catch((error) => {
        log(chalk.red('Error'));
        console.error(error);
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
