/* eslint-disable max-len */
/* global __, steamGameInfo, proxy, myAxiosConfig */
import { RawAxiosRequestHeaders } from 'axios';
import { load } from 'cheerio';
import * as chalk from 'chalk';
import { Logger, netError, sleep, time, http as axios, formatProxy, Cookie } from './tool';
import { EventEmitter } from 'events';
const emitter = new EventEmitter();

class SteamQuestASF {
  awaCookie: Cookie;
  asfUrl: string;
  httpsAgent!: myAxiosConfig['httpsAgent'];
  awaHttpsAgent!: myAxiosConfig['httpsAgent'];
  headers: RawAxiosRequestHeaders;
  botname!: string;
  ownedGames: Array<string> = [];
  ownedAllGames: Array<string> = [];
  maxPlayTimes = 2;
  gamesInfo: Array<steamGameInfo> = [];
  maxArp = 0;
  status = 'none';
  taskStatus: Array<steamGameInfo> = [];
  emitter = emitter;

  constructor({
    awaCookie,
    asfProtocol,
    asfHost,
    asfPort,
    asfPassword = '',
    asfBotname,
    proxy
  }: {
      awaCookie: string,
      asfProtocol: string,
      asfHost: string,
      asfPort: number,
      asfPassword?: string,
      asfBotname: string,
      proxy?: proxy
  }) {
    this.awaCookie = new Cookie(awaCookie);
    this.botname = asfBotname;

    const baseUrl = `${asfProtocol}://${asfHost}:${asfPort}`;
    this.asfUrl = `${baseUrl}/Api/Command`;

    this.headers = {
      accept: 'application/json',
      'Content-Type': 'application/json',
      Host: `${asfHost}:${asfPort}`,
      Origin: baseUrl,
      Referer: `${baseUrl}/page/commands`,
      ...(asfPassword && { Authentication: asfPassword })
    };

    if (proxy?.enable?.includes('asf') && proxy.host && proxy.port) {
      this.httpsAgent = formatProxy(proxy);
    }

    if (proxy?.enable?.includes('awa') && proxy.host && proxy.port) {
      this.awaHttpsAgent = formatProxy(proxy);
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

    const initted = await axios(options)
      .then((response) => {
        globalThis.secrets = [...new Set([...globalThis.secrets, ...Object.values(Cookie.ToJson(response.headers?.['set-cookie']))])];
        if (response.status === 200) {
          if (response.data.Success === true && response.data.Message === 'OK' && response.data.Result) {
            ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.green('OK'));
            return true;
          }
          if (response.data.Message) {
            ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.blue(response.data.Message));
            return false;
          }
          ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.red('Error(1)'));
          new Logger(response.data);
          return false;
        }
        ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.red(`Error(2): ${response.status}`));
        return false;
      })
      .catch((error) => {
        ((error.config as myAxiosConfig)?.Logger || logger).log(chalk.red('Error(0)'));
        globalThis.secrets = [...new Set([...globalThis.secrets, ...Object.values(Cookie.ToJson(error.response?.headers?.['set-cookie']))])];
        new Logger(error);
        return false;
      });
    if (initted) {
      this.emitter.on('steamStop', () => {
        this.resume();
      });
    }
    return initted;
  }
  async getSteamQuests(): Promise<boolean> {
    const logger = new Logger(`${time()}${__('gettingSteamQuestInfo', chalk.yellow('Steam'))}`);
    const options: myAxiosConfig = {
      url: `https://${globalThis.awaHost}/steam/quests`,
      method: 'GET',
      headers: {
        accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
        'accept-encoding': 'gzip, deflate, br',
        'accept-language': 'zh-CN,zh;q=0.9,en;q=0.8,en-GB;q=0.7,en-US;q=0.6',
        'user-agent': globalThis.userAgent
      },
      Logger: logger
    };
    if (this.awaHttpsAgent) options.httpsAgent = this.awaHttpsAgent;
    return axios(options)
      .then(async (response) => {
        globalThis.secrets = [...new Set([...globalThis.secrets, ...Object.values(Cookie.ToJson(response.headers?.['set-cookie']))])];

        if (response.status !== 200) {
          new Logger(`${time()}${chalk.red(`${__('getSteamQuestInfoFailed', chalk.yellow('Steam'))}[Net Error]: ${response.status}`)}`);
          return false;
        }

        const $ = load(response.data);
        const gamesInfo = [];
        for (const row of $('div.container>div.row').toArray()) {
          const $row = $(row);
          const questLink = new URL($row.find('a.btn-steam-quest[href]').attr('href') as string, `https://${globalThis.awaHost}/`).href;
          const [id, started] = await this.getQuestInfo(questLink);

          if (!started || !id) continue;
          const playTime = $row.find('.media-body p').text()
            .trim()
            .match(/([\d]+)[\s]*hour/i)?.[1];
          const arp = $row.find('.text-steam-light').text()
            .trim()
            .match(/([\d]+)[\s]*ARP/i)?.[1];
          gamesInfo.push({
            id: id as string,
            time: playTime ? parseInt(playTime, 10) : 0,
            arp: arp ? parseInt(arp, 10) : 0,
            link: questLink
          });
        }
        this.gamesInfo = gamesInfo;
        new Logger(`${time()}${chalk.green(__('getSteamQuestInfoSuccess', chalk.yellow('Steam')))}`);
        return true;
      })
      .catch((error) => {
        new Logger(time() + chalk.red(__('getSteamQuestInfoFailed', chalk.yellow('Steam'))) + netError(error));
        globalThis.secrets = [...new Set([...globalThis.secrets, ...Object.values(Cookie.ToJson(error.response?.headers?.['set-cookie']))])];
        new Logger(error);
        return false;
      });
  }
  async awaCheckOwnedGames(name: string): Promise<boolean> {
    const logger = new Logger(`${time()}${__('recheckingOwnedGames', chalk.yellow(name))}`, false);
    const taskUrl = `https://${globalThis.awaHost}/steam/quests/${name}`;
    if (name === 'choose-your-own-game') {
      logger.log(chalk.green(__('owned')));
      return (await this.getQuestInfo(taskUrl, true))[1] as boolean;
    }
    const options: myAxiosConfig = {
      url: `https://${globalThis.awaHost}/ajax/user/steam/quests/check-owned-games/${name}`,
      method: 'GET',
      headers: {
        cookie: this.awaCookie.stringify(),
        accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
        'accept-encoding': 'gzip, deflate, br',
        'accept-language': 'zh-CN,zh;q=0.9,en;q=0.8,en-GB;q=0.7,en-US;q=0.6',
        'user-agent': globalThis.userAgent,
        referer: taskUrl
      },
      Logger: logger
    };
    if (this.awaHttpsAgent) options.httpsAgent = this.awaHttpsAgent;
    return axios(options)
      .then(async (response) => {
        globalThis.secrets = [...new Set([...globalThis.secrets, ...Object.values(Cookie.ToJson(response.headers?.['set-cookie']))])];
        if (response.status !== 200) {
          ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.red(`Error(1): ${response.status}`));
          return false;
        }

        if (response.data?.installed === true) {
          ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.green(__('owned')));
          return (await this.getQuestInfo(taskUrl, true))[1] as boolean;
        }
        ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.yellow(__('notOwned')));
        return false;
      })
      .catch((error) => {
        ((error.config as myAxiosConfig)?.Logger || logger).log(chalk.red('Error(0)') + netError(error));
        globalThis.secrets = [...new Set([...globalThis.secrets, ...Object.values(Cookie.ToJson(error.response?.headers?.['set-cookie']))])];
        new Logger(error);
        return false;
      });
  }
  async getQuestInfo(url: string, isRetry = false): Promise<Array<string | boolean>> {
    const name = url.match(/steam\/quests\/(.+)/)?.[1] ;
    const logger = new Logger(`${time()}${__('gettingSingleSteamQuestInfo', chalk.yellow(name || url))}`, false);
    const options: myAxiosConfig = {
      url,
      method: 'GET',
      responseType: 'text',
      headers: {
        cookie: this.awaCookie.stringify(),
        accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
        'accept-encoding': 'gzip, deflate, br',
        'accept-language': 'zh-CN,zh;q=0.9,en;q=0.8,en-GB;q=0.7,en-US;q=0.6',
        'user-agent': globalThis.userAgent,
        referer: `https://${globalThis.awaHost}/steam/quests`
      },
      Logger: logger
    };
    if (this.awaHttpsAgent) options.httpsAgent = this.awaHttpsAgent;

    return axios(options)
      .then(async (response) => {
        globalThis.secrets = [...new Set([...globalThis.secrets, ...Object.values(Cookie.ToJson(response.headers?.['set-cookie']))])];
        const $ = load(response.data);
        const id = $('img[src*="cdn.cloudflare.steamstatic.com/steam/apps/"]').eq(0)
          .attr('src')
          ?.match(/steam\/apps\/([\d]+)/)?.[1] ||
          response.data.match(/cdn\.cloudflare\.steamstatic\.com\/steam\/apps\/([\d]+)/)?.[1] || '';
        if (response.data.includes('You have completed this quest')) {
          ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.green(__('steamQuestCompleted')));
          return [id, false];
        }
        if (response.data.includes('This quest requires that you own')) {
          if (name && !isRetry) {
            ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.yellow(__('steamQuestRecheck')));
            return [id, await this.awaCheckOwnedGames(name)];
          }
          ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.yellow(__('steamQuestSkipped')));
          return [id, false];
        }
        if (response.data.includes('Launch Game')) {
          ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.green(__('steamQuestStarted')));
          return [id, true];
        }
        if (response.data.includes('Sync Games')) {
          ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.yellow(__('steamQuestNotChoose')));
          if (isRetry) {
            return [id, false];
          }
          const steamGameId = $('#userGames>option').eq(0).attr('value');
          if (!steamGameId) {
            ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.yellow(__('syncSteamGamesRequired')));
            if (await this.syncGames(url)) {
              return await this.getQuestInfo(url, true);
            }
            new Logger(`${time()}${chalk.red(__('noSteamGames', url))}`, false);
            return [id, false];
          }
          await this.chooseOwnGame(url, steamGameId);
          return await this.getQuestInfo(url, true);
        }
        if (response.data.includes('Start Quest')) {
          ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.green('OK'));
          return [id, await this.startQuest(url)];
        }
        ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.red(`Error(1): ${response.status}`));
        return [id, false];
      })
      .catch((error) => {
        ((error.config as myAxiosConfig)?.Logger || logger).log(chalk.red('Error(0)') + netError(error));
        globalThis.secrets = [...new Set([...globalThis.secrets, ...Object.values(Cookie.ToJson(error.response?.headers?.['set-cookie']))])];
        new Logger(error);
        return ['', false];
      });
  }
  async syncGames(url: string): Promise<boolean> {
    const logger = new Logger(`${time()}${__('syncingGames')}`, false);
    const options: myAxiosConfig = {
      url: url.replace('steam/quests', 'ajax/user/steam/quests/sync-owned-games'),
      method: 'GET',
      responseType: 'json',
      headers: {
        cookie: this.awaCookie.stringify(),
        accept: '*/*',
        'accept-encoding': 'gzip, deflate, br',
        'accept-language': 'zh-CN,zh;q=0.9,en;q=0.8,en-GB;q=0.7,en-US;q=0.6',
        'user-agent': globalThis.userAgent,
        referer: url
      },
      Logger: logger
    };
    if (this.awaHttpsAgent) options.httpsAgent = this.awaHttpsAgent;

    return axios(options)
      .then(async (response) => {
        globalThis.secrets = [...new Set([...globalThis.secrets, ...Object.values(Cookie.ToJson(response.headers?.['set-cookie']))])];
        if (response.status !== 200) {
          ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.red('Error(1)'));
          new Logger(response.data || response.statusText);
          return false;
        }
        if (response.data?.success) {
          ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.green(response.data?.message || 'OK'));
          return true;
        }
        if (response.data?.message) {
          ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.yellow(response.data?.message));
        } else {
          ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.yellow('Warning'));
          new Logger(response.data || response.statusText);
        }
        return true;
      })
      .catch((error) => {
        ((error.config as myAxiosConfig)?.Logger || logger).log(chalk.red('Error(0)') + netError(error));
        globalThis.secrets = [...new Set([...globalThis.secrets, ...Object.values(Cookie.ToJson(error.response?.headers?.['set-cookie']))])];
        new Logger(error);
        return false;
      });
  }
  async chooseOwnGame(url: string, steamGameId: string): Promise<boolean> {
    const logger = new Logger(`${time()}${__('choosingOwnGame', chalk.yellow(steamGameId))}`, false);
    const options: myAxiosConfig = {
      url: url.replace('steam/quests', 'ajax/user/steam/quests/start-select-own'),
      method: 'POST',
      responseType: 'text',
      headers: {
        cookie: this.awaCookie.stringify(),
        accept: '*/*',
        'accept-encoding': 'gzip, deflate, br',
        'accept-language': 'zh-CN,zh;q=0.9,en;q=0.8,en-GB;q=0.7,en-US;q=0.6',
        'user-agent': globalThis.userAgent,
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        referer: url
      },
      data: steamGameId,
      Logger: logger
    };
    if (this.awaHttpsAgent) options.httpsAgent = this.awaHttpsAgent;

    return axios(options)
      .then(async (response) => {
        globalThis.secrets = [...new Set([...globalThis.secrets, ...Object.values(Cookie.ToJson(response.headers?.['set-cookie']))])];
        if (response.status === 200) {
          ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.green('OK'));
          return true;
        }
        ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.red('Error(1)'));
        new Logger(response.data || response.statusText);
        return false;
      })
      .catch((error) => {
        ((error.config as myAxiosConfig)?.Logger || logger).log(chalk.red('Error(0)') + netError(error));
        globalThis.secrets = [...new Set([...globalThis.secrets, ...Object.values(Cookie.ToJson(error.response?.headers?.['set-cookie']))])];
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
        cookie: this.awaCookie.stringify(),
        'user-agent': globalThis.userAgent,
        referer: url
      },
      Logger: logger
    };
    if (this.awaHttpsAgent) options.httpsAgent = this.awaHttpsAgent;
    return axios(options)
      .then((response) => {
        globalThis.secrets = [...new Set([...globalThis.secrets, ...Object.values(Cookie.ToJson(response.headers?.['set-cookie']))])];
        if (response.data.success) {
          ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.green('OK'));
          return true;
        }
        ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.red(`Error(1): ${response.data.message || response.status}`));
        return false;
      })
      .catch((error) => {
        ((error.config as myAxiosConfig)?.Logger || logger).log(chalk.red('Error(0)') + netError(error));
        globalThis.secrets = [...new Set([...globalThis.secrets, ...Object.values(Cookie.ToJson(error.response?.headers?.['set-cookie']))])];
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
          cookie: this.awaCookie.stringify(),
          accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
          'accept-encoding': 'gzip, deflate, br',
          'accept-language': 'zh-CN,zh;q=0.9,en;q=0.8,en-GB;q=0.7,en-US;q=0.6',
          'user-agent': globalThis.userAgent,
          referer: `https://${globalThis.awaHost}/steam/quests`
        },
        Logger: logger
      };
      if (this.awaHttpsAgent) options.httpsAgent = this.awaHttpsAgent;
      await axios(options)
        .then((response) => {
          globalThis.secrets = [...new Set([...globalThis.secrets, ...Object.values(Cookie.ToJson(response.headers?.['set-cookie']))])];
          if (!response.data.includes('aria-valuenow')) {
            ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.red(__('noProgressBar')));
            return false;
          }
          const progress = response.data.match(/aria-valuenow="([\d]+?)"/)?.[1];
          if (progress) {
            this.taskStatus[index].progress = progress;
            ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.yellow(`${progress}%`));
            return true;
          }
          ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.red(__('noProgress')));
          return false;
        })
        .catch((error) => {
          ((error.config as myAxiosConfig)?.Logger || logger).log(chalk.red('Error(0)') + netError(error));
          globalThis.secrets = [...new Set([...globalThis.secrets, ...Object.values(Cookie.ToJson(error.response?.headers?.['set-cookie']))])];
          new Logger(error);
          return false;
        });
    }
    if (this.taskStatus?.filter((e) => parseInt(e.progress || '0', 10) >= 100)?.length === this.taskStatus?.length && !globalThis.steamEventGameId) {
      this.emitter.emit('taskComplete', 'steam');
      new Logger(time() + chalk.yellow('Steam') + chalk.green(__('steamQuestFinished')));
      await this.resume();
      return true;
    }
    await sleep(60 * 10);
    return await this.checkStatus();
  }
  async getOwnedGames(): Promise<boolean> {
    if (!await this.getSteamQuests()) return false;
    if (this.gamesInfo.length === 0 && !globalThis.steamEventGameId) return true;
    await this.addLicense();
    const logger = new Logger(`${time()}${__('matchingGames', chalk.yellow('Steam'))}`, false);
    const options: myAxiosConfig = {
      url: this.asfUrl,
      method: 'POST',
      headers: this.headers,
      data: `{"Command":"!owns ${this.botname} ${this.gamesInfo.map((e) => e.id).join(',')}${globalThis.steamEventGameId ? `,${globalThis.steamEventGameId}` : ''}"}`,
      Logger: logger
    };
    if (this.httpsAgent) options.httpsAgent = this.httpsAgent;
    return axios(options)
      .then((response) => {
        globalThis.secrets = [...new Set([...globalThis.secrets, ...Object.values(Cookie.ToJson(response.headers?.['set-cookie']))])];
        if (response.status !== 200) {
          ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.red(`Error(2): ${response.status}`));
          return false;
        }
        if (response.data.Success === true && response.data.Message === 'OK' && response.data.Result) {
          this.ownedAllGames = [...new Set(response.data.Result.split('\n').filter((e: string) => e.includes('|')).map((e: string) => e.trim().match(/app\/([\d]+)/)?.[1])
            .filter((e: undefined | string) => e))] as Array<string>;
          this.ownedGames = this.ownedAllGames.filter((id) => id !== globalThis.steamEventGameId);
          if (this.ownedGames.length > 0) {
            this.maxArp = this.ownedGames.map((id) => this.gamesInfo.find((info) => info.id === id)?.arp || 0).reduce((acr, cur) => acr + cur);
            this.maxPlayTimes = Math.max(...this.ownedGames.map((id) => this.gamesInfo.find((info) => info.id === id)?.time || 2));
            this.taskStatus = this.ownedGames.map((id) => this.gamesInfo.find((info) => info.id === id)).filter((e) => e) as Array<steamGameInfo>;
          }
          ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.green('OK'));
          return true;
        }
        if (response.data.Message) {
          ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.blue(response.data.Message));
          return false;
        }
        ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.red('Error(1)'));
        new Logger(response.data);
        return false;
      })
      .catch((error) => {
        ((error.config as myAxiosConfig)?.Logger || logger).log(chalk.red('Error(0)'));
        globalThis.secrets = [...new Set([...globalThis.secrets, ...Object.values(Cookie.ToJson(error.response?.headers?.['set-cookie']))])];
        new Logger(error);
        return false;
      });
  }
  async playGames(): Promise<boolean> {
    if (!await this.getOwnedGames()) {
      this.status = 'stopped';
      return false;
    }
    if (this.ownedAllGames.length === 0) {
      new Logger(time() + chalk.yellow(__('noGamesAlert')));
      this.status = 'stopped';
      return false;
    }

    if (!this.taskStatus?.length) {
      this.status = 'stopped';
      return false;
    }

    const logger = new Logger(`${time()}${__('usingASF', chalk.yellow('ASF'))}`, false);
    const options: myAxiosConfig = {
      url: this.asfUrl,
      method: 'POST',
      headers: this.headers,
      data: `{"Command":"!play ${this.botname} ${this.ownedAllGames.join(',')}"}`,
      Logger: logger
    };
    if (this.httpsAgent) options.httpsAgent = this.httpsAgent;
    const started = await axios(options)
      .then((response) => {
        globalThis.secrets = [...new Set([...globalThis.secrets, ...Object.values(Cookie.ToJson(response.headers?.['set-cookie']))])];
        if (response.status !== 200) {
          ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.red(`Error(2): ${response.status}`));
          return false;
        }
        if (response.data.Success === true && response.data.Message === 'OK' && response.data.Result) {
          this.status = 'running';
          ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.green('OK'));
          return true;
        }
        if (response.data.Message) {
          ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.blue(response.data.Message));
          return false;
        }
        ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.red('Error(1)'));
        new Logger(response.data);
        return false;
      })
      .catch((error) => {
        ((error.config as myAxiosConfig)?.Logger || logger).log(chalk.red('Error(0)'));
        globalThis.secrets = [...new Set([...globalThis.secrets, ...Object.values(Cookie.ToJson(error.response?.headers?.['set-cookie']))])];
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
        globalThis.secrets = [...new Set([...globalThis.secrets, ...Object.values(Cookie.ToJson(response.headers?.['set-cookie']))])];
        if (response.status !== 200) {
          ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.red(`Error(2): ${response.status}`));
          return false;
        }
        if (response.data.Success === true && response.data.Message === 'OK' && response.data.Result) {
          this.status = 'stopped';
          ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.green(response.data.Result));
          return true;
        }
        if (response.data.Message) {
          ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.blue(response.data.Message));
          return false;
        }
        ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.red('Error(1)'));
        new Logger(response.data);
        return false;
      })
      .catch((error) => {
        ((error.config as myAxiosConfig)?.Logger || logger).log(chalk.red('Error(0)'));
        globalThis.secrets = [...new Set([...globalThis.secrets, ...Object.values(Cookie.ToJson(error.response?.headers?.['set-cookie']))])];
        new Logger(error);
        return false;
      });
  }
  async addLicense(): Promise<boolean> {
    const logger = new Logger(`${time()}${__('addingLicense')}`, false);
    const options: myAxiosConfig = {
      url: this.asfUrl,
      method: 'POST',
      headers: this.headers,
      data: `{"Command":"!addlicense ${this.botname} ${this.gamesInfo.map((e) => `app/${e.id}`).join(',')}${globalThis.steamEventGameId ? `,app/${globalThis.steamEventGameId}` : ''}"}`,
      Logger: logger
    };
    if (this.httpsAgent) options.httpsAgent = this.httpsAgent;
    return axios(options)
      .then((response) => {
        globalThis.secrets = [...new Set([...globalThis.secrets, ...Object.values(Cookie.ToJson(response.headers?.['set-cookie']))])];
        if (response.status !== 200) {
          ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.red(`Error(2): ${response.status}`));
          return false;
        }
        if (response.data.Success === true && response.data.Message === 'OK' && response.data.Result) {
          ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.green('OK'));
          return true;
        }
        if (response.data.Message) {
          ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.blue(response.data.Message));
          return false;
        }
        ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.red('Error(1)'));
        new Logger(response.data);
        return false;
      })
      .catch((error) => {
        ((error.config as myAxiosConfig)?.Logger || logger).log(chalk.red('Error(0)'));
        globalThis.secrets = [...new Set([...globalThis.secrets, ...Object.values(Cookie.ToJson(error.response?.headers?.['set-cookie']))])];
        new Logger(error);
        return false;
      });
  }
}

export { SteamQuestASF };
