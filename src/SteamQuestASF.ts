/* eslint-disable max-len */
/* global __, steamGameInfo, proxy, myAxiosConfig */
import { AxiosRequestHeaders } from 'axios';
import { load } from 'cheerio';
import * as chalk from 'chalk';
import { Logger, netError, sleep, time, http as axios, formatProxy } from './tool';
import * as events from 'events';
const EventEmitter = new events.EventEmitter();

class SteamQuestASF {
  awaCookie: string;
  asfUrl: string;
  httpsAgent!: myAxiosConfig['httpsAgent'];
  headers: AxiosRequestHeaders;
  botname!: string;
  ownedGames: Array<string> = [];
  maxPlayTimes = 2;
  gamesInfo: Array<steamGameInfo> = [];
  maxArp = 0;
  status = 'none';
  taskStatus!: Array<steamGameInfo>;
  awaHost: string;
  EventEmitter = EventEmitter;

  constructor({ awaCookie, awaHost, asfProtocol, asfHost, asfPort, asfPassword, asfBotname, proxy }: { awaCookie: string, awaHost: string, asfProtocol: string, asfHost: string, asfPort: number, asfPassword?: string, asfBotname: string, proxy?: proxy }) {
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
    if (asfPassword) this.headers.Authentication = asfPassword;
    if (proxy?.enable?.includes('asf') && proxy.host && proxy.port) {
      this.httpsAgent = formatProxy(proxy);
    }
  }

  async init(): Promise<boolean> {
    const logger = new Logger(`${time()}${__('initing', chalk.yellow('ASF'))}`, false);
    const options: myAxiosConfig = {
      url: this.asfUrl,
      method: 'POST',
      headers: this.headers,
      data: '{"Command":"!stats"}',
      Logger: logger
    };
    if (this.httpsAgent) options.httpsAgent = this.httpsAgent;

    return axios(options)
      .then((response) => {
        globalThis.secrets = [...new Set([...globalThis.secrets.split('|'), ...(response.headers['set-cookie'] || []).map((e) => e.split(';')[0].trim().split('=')[1]).filter((e: any) => e && e.length > 5)])].join('|');
        if (response.status === 200) {
          if (response.data.Success === true && response.data.Message === 'OK' && response.data.Result) {
            ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.green('OK'));
            return true;
          }
          if (response.data.Message) {
            ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.blue(response.data.Message));
            return false;
          }
          ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.blue('Error'));
          new Logger(response.data);
          return false;
        }
        ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.red(`Error: ${response.status}`));
        return false;
      })
      .catch((error) => {
        ((error.config as myAxiosConfig)?.Logger || logger).log(chalk.red('Error'));
        globalThis.secrets = [...new Set([...globalThis.secrets.split('|'), ...(error.response?.headers?.['set-cookie'] || []).map((e: string) => e.split(';')[0].trim().split('=')[1]).filter((e: any) => e && e.length > 5)])].join('|');
        new Logger(error);
        return false;
      });
  }
  async getSteamQuests(): Promise<boolean> {
    const logger = new Logger(`${time()}${__('gettingSteamQuestInfo', chalk.yellow('Steam'))}`);
    const options: myAxiosConfig = {
      url: `https://${this.awaHost}/steam/quests`,
      method: 'GET',
      headers: {
        accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
        'accept-encoding': 'gzip, deflate, br',
        'accept-language': 'zh-CN,zh;q=0.9,en;q=0.8,en-GB;q=0.7,en-US;q=0.6',
        'user-agent': globalThis.userAgent
      },
      Logger: logger
    };
    if (this.httpsAgent) options.httpsAgent = this.httpsAgent;
    return axios(options)
      .then(async (response) => {
        globalThis.secrets = [...new Set([...globalThis.secrets.split('|'), ...(response.headers['set-cookie'] || []).map((e) => e.split(';')[0].trim().split('=')[1]).filter((e: any) => e && e.length > 5)])].join('|');
        if (response.status === 200) {
          const $ = load(response.data);
          const gamesInfo = [];
          for (const row of $('div.container>div.row').toArray()) {
            const $row = $(row);
            const id = $row.find('img[src*="cdn.cloudflare.steamstatic.com/steam/apps/"]').eq(0)
              .attr('src')
              ?.match(/steam\/apps\/([\d]+)/)?.[1];
            if (!id) continue;
            // await this.add2library(id);
            const questLink = new URL($row.find('a.btn-steam-quest[href]').attr('href') as string, `https://${this.awaHost}/`).href;
            const started = await this.getQuestInfo(questLink);
            if (!started) continue;
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
          new Logger(`${time()}${chalk.green(__('getSteamQuestInfoSuccess', chalk.yellow('Steam')))}`);
          return true;
        }
        new Logger(`${time()}${chalk.red(`${__('getSteamQuestInfoFailed', chalk.yellow('Steam'))}[Net Error]: ${response.status}`)}`);
        return false;
      })
      .catch((error) => {
        new Logger(time() + chalk.red(__('getSteamQuestInfoFailed', chalk.yellow('Steam'))) + netError(error));
        globalThis.secrets = [...new Set([...globalThis.secrets.split('|'), ...(error.response?.headers?.['set-cookie'] || []).map((e: string) => e.split(';')[0].trim().split('=')[1]).filter((e: any) => e && e.length > 5)])].join('|');
        new Logger(error);
        return false;
      });
  }
  /*
  async add2library(id: string):Promise<boolean> {
    log(`${time()}${__('adding2library', chalk.yellow('ASF'), chalk.yellow(id))}`, false);
    const options: myAxiosConfig = {
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
  async awaCheckOwnedGames(name: string): Promise<boolean> {
    const logger = new Logger(`${time()}${__('recheckingOwnedGames', chalk.yellow(name))}`, false);
    const taskUrl = `https://www.alienwarearena.com/steam/quests/${name}`;
    const options: myAxiosConfig = {
      url: `https://www.alienwarearena.com/ajax/user/steam/quests/check-owned-games/${name}`,
      method: 'GET',
      headers: {
        cookie: this.awaCookie,
        accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
        'accept-encoding': 'gzip, deflate, br',
        'accept-language': 'zh-CN,zh;q=0.9,en;q=0.8,en-GB;q=0.7,en-US;q=0.6',
        'user-agent': globalThis.userAgent,
        referer: taskUrl
      },
      Logger: logger
    };
    if (this.httpsAgent) options.httpsAgent = this.httpsAgent;
    return axios(options)
      .then(async (response) => {
        globalThis.secrets = [...new Set([...globalThis.secrets.split('|'), ...(response.headers['set-cookie'] || []).map((e) => e.split(';')[0].trim().split('=')[1]).filter((e: any) => e && e.length > 5)])].join('|');
        if (response.status === 200) {
          if (response.data?.installed === true) {
            ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.green(__('owned')));
            return this.getQuestInfo(taskUrl, true);
          }
          ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.yellow(__('notOwned')));
          return false;
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
  }
  async getQuestInfo(url: string, isRetry = false): Promise<boolean> {
    const name = url.match(/steam\/quests\/(.+)/)?.[1] ;
    const logger = new Logger(`${time()}${__('gettingSingleSteamQuestInfo', chalk.yellow(name || url))}`, false);
    const options: myAxiosConfig = {
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
      },
      Logger: logger
    };
    if (this.httpsAgent) options.httpsAgent = this.httpsAgent;

    return axios(options)
      .then((response) => {
        globalThis.secrets = [...new Set([...globalThis.secrets.split('|'), ...(response.headers['set-cookie'] || []).map((e) => e.split(';')[0].trim().split('=')[1]).filter((e: any) => e && e.length > 5)])].join('|');
        if (response.data.includes('You have completed this quest')) {
          ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.green(__('steamQuestCompleted')));
          return false;
        }
        if (response.data.includes('This quest requires that you own')) {
          if (name && !isRetry) {
            ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.yellow(__('steamQuestRecheck')));
            return this.awaCheckOwnedGames(name);
          }
          ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.yellow(__('steamQuestSkipped')));
          return false;
        }
        if (response.data.includes('Launch Game')) {
          ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.green(__('steamQuestStarted')));
          return true;
        }
        if (response.data.includes('Start Quest')) {
          ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.green('OK'));
          return this.startQuest(url);
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
  }
  async startQuest(url: string): Promise<boolean> {
    const logger = new Logger(`${time()}${__('startingSteamQuest', chalk.yellow(url))}`, false);
    const options: myAxiosConfig = {
      url: url.replace('steam/quests', 'ajax/user/steam/quests/start'),
      method: 'GET',
      headers: {
        cookie: this.awaCookie,
        'user-agent': globalThis.userAgent,
        referer: url
      },
      Logger: logger
    };
    if (this.httpsAgent) options.httpsAgent = this.httpsAgent;
    return axios(options)
      .then((response) => {
        globalThis.secrets = [...new Set([...globalThis.secrets.split('|'), ...(response.headers['set-cookie'] || []).map((e) => e.split(';')[0].trim().split('=')[1]).filter((e: any) => e && e.length > 5)])].join('|');
        if (response.data.success) {
          ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.green('OK'));
          return true;
        }
        ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.red(`Error: ${response.data.message || response.status}`));
        return false;
      })
      .catch((error) => {
        ((error.config as myAxiosConfig)?.Logger || logger).log(chalk.red('Error') + netError(error));
        globalThis.secrets = [...new Set([...globalThis.secrets.split('|'), ...(error.response?.headers?.['set-cookie'] || []).map((e: string) => e.split(';')[0].trim().split('=')[1]).filter((e: any) => e && e.length > 5)])].join('|');
        new Logger(error);
        return false;
      });
  }
  async checkStatus(): Promise<boolean> {
    if (this.status === 'stopped') return true;
    for (const index in this.taskStatus) {
      const logger = new Logger(`${time()}${__('checkingProgress', chalk.yellow(this.taskStatus[index].link))}`, false);
      const options: myAxiosConfig = {
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
        },
        Logger: logger
      };
      if (this.httpsAgent) options.httpsAgent = this.httpsAgent;
      await axios(options)
        .then((response) => {
          globalThis.secrets = [...new Set([...globalThis.secrets.split('|'), ...(response.headers['set-cookie'] || []).map((e) => e.split(';')[0].trim().split('=')[1]).filter((e: any) => e && e.length > 5)])].join('|');
          if (response.data.includes('aria-valuenow')) {
            const progress = response.data.match(/aria-valuenow="([\d]+?)"/)?.[1];
            if (progress) {
              this.taskStatus[index].progress = progress;
              ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.yellow(`${progress}%`));
              return true;
            }
            ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.red(__('noProgress')));
            return false;
          }
          ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.red(__('noProgressBar')));
          return false;
        })
        .catch((error) => {
          ((error.config as myAxiosConfig)?.Logger || logger).log(chalk.red('Error') + netError(error));
          globalThis.secrets = [...new Set([...globalThis.secrets.split('|'), ...(error.response?.headers?.['set-cookie'] || []).map((e: string) => e.split(';')[0].trim().split('=')[1]).filter((e: any) => e && e.length > 5)])].join('|');
          new Logger(error);
          return false;
        });
    }
    if (this.taskStatus.filter((e) => parseInt(e.progress || '0', 10) >= 100).length === this.taskStatus.length) {
      this.EventEmitter.emit('complete');
      new Logger(time() + chalk.yellow('Steam') + chalk.green(__('steamQuestFinished')));
      await this.resume();
      return true;
    }
    await sleep(60 * 10);
    return await this.checkStatus();
  }
  async getOwnedGames(): Promise<boolean> {
    if (!await this.getSteamQuests()) return false;
    if (this.gamesInfo.length === 0) return true;
    const logger = new Logger(`${time()}${__('matchingGames', chalk.yellow('Steam'))}`, false);
    const options: myAxiosConfig = {
      url: this.asfUrl,
      method: 'POST',
      headers: this.headers,
      data: `{"Command":"!owns ${this.botname} ${this.gamesInfo.map((e) => e.id).join(',')}"}`,
      Logger: logger
    };
    if (this.httpsAgent) options.httpsAgent = this.httpsAgent;
    return axios(options)
      .then((response) => {
        globalThis.secrets = [...new Set([...globalThis.secrets.split('|'), ...(response.headers['set-cookie'] || []).map((e) => e.split(';')[0].trim().split('=')[1]).filter((e: any) => e && e.length > 5)])].join('|');
        if (response.status === 200) {
          if (response.data.Success === true && response.data.Message === 'OK' && response.data.Result) {
            this.ownedGames = [...new Set(response.data.Result.split('\n').filter((e: string) => e.includes('|')).map((e: string) => e.trim().match(/app\/([\d]+)/)?.[1])
              .filter((e: undefined | string) => e))] as Array<string>;
            this.maxArp = this.ownedGames.map((id) => this.gamesInfo.find((info) => info.id === id)?.arp || 0).reduce((acr, cur) => acr + cur);
            this.maxPlayTimes = Math.max(...this.ownedGames.map((id) => this.gamesInfo.find((info) => info.id === id)?.time || 2));
            this.taskStatus = this.ownedGames.map((id) => this.gamesInfo.find((info) => info.id === id)).filter((e) => e) as Array<steamGameInfo>;
            ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.green('OK'));
            return true;
          }
          if (response.data.Message) {
            ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.blue(response.data.Message));
            return false;
          }
          ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.blue('Error'));
          new Logger(response.data);
          return false;
        }
        ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.red(`Error: ${response.status}`));
        return false;
      })
      .catch((error) => {
        ((error.config as myAxiosConfig)?.Logger || logger).log(chalk.red('Error'));
        globalThis.secrets = [...new Set([...globalThis.secrets.split('|'), ...(error.response?.headers?.['set-cookie'] || []).map((e: string) => e.split(';')[0].trim().split('=')[1]).filter((e: any) => e && e.length > 5)])].join('|');
        new Logger(error);
        return false;
      });
  }
  async playGames(): Promise<boolean> {
    if (!await this.getOwnedGames()) return false;
    if (this.ownedGames.length === 0) {
      new Logger(time() + chalk.yellow(__('noGamesAlert')));
      this.status = 'stopped';
      return false;
    }
    const logger = new Logger(`${time()}${__('usingASF', chalk.yellow('ASF'))}`, false);
    const options: myAxiosConfig = {
      url: this.asfUrl,
      method: 'POST',
      headers: this.headers,
      data: `{"Command":"!play ${this.botname} ${this.ownedGames.join(',')}"}`,
      Logger: logger
    };
    if (this.httpsAgent) options.httpsAgent = this.httpsAgent;
    const started = await axios(options)
      .then((response) => {
        globalThis.secrets = [...new Set([...globalThis.secrets.split('|'), ...(response.headers['set-cookie'] || []).map((e) => e.split(';')[0].trim().split('=')[1]).filter((e: any) => e && e.length > 5)])].join('|');
        if (response.status === 200) {
          if (response.data.Success === true && response.data.Message === 'OK' && response.data.Result) {
            this.status = 'running';
            ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.green('OK'));
            return true;
          }
          if (response.data.Message) {
            ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.blue(response.data.Message));
            return false;
          }
          ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.blue('Error'));
          new Logger(response.data);
          return false;
        }
        ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.red(`Error: ${response.status}`));
        return false;
      })
      .catch((error) => {
        ((error.config as myAxiosConfig)?.Logger || logger).log(chalk.red('Error'));
        globalThis.secrets = [...new Set([...globalThis.secrets.split('|'), ...(error.response?.headers?.['set-cookie'] || []).map((e: string) => e.split(';')[0].trim().split('=')[1]).filter((e: any) => e && e.length > 5)])].join('|');
        new Logger(error);
        return false;
      });
    if (!started) return false;
    await sleep(10 * 60);
    return await this.checkStatus();
  }
  async resume(): Promise<boolean> {
    if (this.status === 'stopped') return true;
    const logger = new Logger(`${time()}${__('stoppingPlayingGames')}`, false);
    const options: myAxiosConfig = {
      url: this.asfUrl,
      method: 'POST',
      headers: this.headers,
      data: `{"Command":"!resume ${this.botname}"}`,
      Logger: logger
    };
    if (this.httpsAgent) options.httpsAgent = this.httpsAgent;
    return axios(options)
      .then((response) => {
        globalThis.secrets = [...new Set([...globalThis.secrets.split('|'), ...(response.headers['set-cookie'] || []).map((e) => e.split(';')[0].trim().split('=')[1]).filter((e: any) => e && e.length > 5)])].join('|');
        if (response.status === 200) {
          if (response.data.Success === true && response.data.Message === 'OK' && response.data.Result) {
            this.status = 'stopped';
            ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.green(response.data.Result));
            return true;
          }
          if (response.data.Message) {
            ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.blue(response.data.Message));
            return false;
          }
          ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.blue('Error'));
          new Logger(response.data);
          return false;
        }
        ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.red(`Error: ${response.status}`));
        return false;
      })
      .catch((error) => {
        ((error.config as myAxiosConfig)?.Logger || logger).log(chalk.red('Error'));
        globalThis.secrets = [...new Set([...globalThis.secrets.split('|'), ...(error.response?.headers?.['set-cookie'] || []).map((e: string) => e.split(';')[0].trim().split('=')[1]).filter((e: any) => e && e.length > 5)])].join('|');
        new Logger(error);
        return false;
      });
  }
}

export { SteamQuestASF };
