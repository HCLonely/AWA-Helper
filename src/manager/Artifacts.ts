/* eslint-disable max-len */
/* global __, proxy, myAxiosConfig */
import { RawAxiosRequestHeaders } from 'axios';
import * as fs from 'fs';
import { load } from 'cheerio';
import * as chalk from 'chalk';
import { time, netError, formatProxy, Cookie } from '../tool';
import { Logger, http as axios, push } from './tool';
import { parse } from 'yaml';

class Artifacts {
  headers!: RawAxiosRequestHeaders;
  cookie!: Cookie;
  httpsAgent!: myAxiosConfig['httpsAgent'];
  newCookie!: string;
  proxy?: {
    server: string
    username?: string
    password?: string
  };
  userProfileUrl!: string;
  oldArtifacts!: Array<number>;
  activePerks!: string;
  initted = true;

  constructor(configPath: string) {
    const configString = fs.readFileSync(configPath).toString();
    const { awaCookie, proxy }: { awaCookie?: string, proxy?: proxy } = parse(configString);
    if (!awaCookie) {
      new Logger(time() + chalk.yellow(__('missingAwaCookie')));
      this.initted = false;
      return this;
    }

    this.newCookie = awaCookie;
    this.cookie = new Cookie(awaCookie);
    this.headers = {
      cookie: this.cookie.stringify(),
      'user-agent': globalThis.userAgent,
      'accept-encoding': 'gzip, deflate, br',
      'accept-language': 'zh-CN,zh;q=0.9,en;q=0.8,en-GB;q=0.7,en-US;q=0.6'
    };
    if (proxy?.enable?.includes('awa') && proxy.host && proxy.port) {
      this.httpsAgent = formatProxy(proxy);
      this.proxy = {
        server: `${proxy.protocol || 'http'}://${proxy.host}:${proxy.port}`
      };
      if (proxy.username && proxy.password) {
        this.proxy.username = proxy.username;
        this.proxy.password = proxy.password;
      }
    }
  }
  async init(): Promise<number> {
    const REMEMBERME = this.cookie.get('REMEMBERME');
    if (REMEMBERME) {
      await this.updateCookie(`REMEMBERME=${REMEMBERME}`);
    }
    if (this.cookie.get('REMEMBERME') === 'deleted') {
      return 602;
    }
    const result = await this.updateInfo();
    if (result !== 200) {
      return result;
    }
    this.newCookie = `${this.cookie.get('REMEMBERME') ? `REMEMBERME=${this.cookie.get('REMEMBERME')}` : ''};${this.cookie.get('PHPSESSID') ? `PHPSESSID=${this.cookie.get('PHPSESSID')}` : ''};${this.cookie.get('sc') ? `sc=${this.cookie.get('sc')}` : ''};`;
    return 200;
  }
  async updateCookie(REMEMBERME: string): Promise<boolean> {
    const logger = new Logger(`${time()}${__('updatingCookie', chalk.yellow('AWA Cookie'))}...`, false);
    const options: myAxiosConfig = {
      url: `https://${globalThis.awaHost}/`,
      method: 'GET',
      headers: {
        ...this.headers,
        cookie: REMEMBERME,
        accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9'
      },
      maxRedirects: 0,
      validateStatus: (status: number) => status === 302 || status === 200,
      Logger: logger
    };
    if (this.httpsAgent) options.httpsAgent = this.httpsAgent;
    return axios(options)
      .then((response) => {
        globalThis.secrets = [...new Set([...globalThis.secrets, ...Object.values(Cookie.ToJson(response.headers?.['set-cookie']))])];
        if (response.status === 200 && response.data.toLowerCase().includes('we have detected an issue with your network')) {
          ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.red(__('ipBanned')));
          return false;
        }
        if (response.status === 302 && response.headers['set-cookie']?.length) {
          this.headers.cookie = this.cookie.update(response.headers['set-cookie']).stringify();
          const homeSite = this.cookie.get('home_site');
          if (homeSite && globalThis.awaHost !== homeSite) {
            globalThis.awaHost = homeSite;
            ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.yellow(__('redirected')));
            return this.updateCookie(REMEMBERME);
          }
          if (this.cookie.get('REMEMBERME') === 'deleted') {
            ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.red(`Error: ${__('cookieExpired', chalk.yellow('awaCookie'))}`));
            return false;
          }
          if (!this.cookie.get('REMEMBERME')) {
            this.headers.cookie = this.cookie.update(REMEMBERME).stringify();
          }
          ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.green('OK'));
          return true;
        }
        ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.red('Error(1)'));
        new Logger(response);
        return false;
      })
      .catch((error) => {
        ((error.config as myAxiosConfig)?.Logger || logger).log(chalk.red('Error(0)') + netError(error));
        globalThis.secrets = [...new Set([...globalThis.secrets, ...Object.values(Cookie.ToJson(error.response?.headers?.['set-cookie']))])];
        new Logger(error);
        return false;
      });
  }
  async updateInfo(): Promise<number> {
    const logger = new Logger(time() + __('verifyingToken', chalk.yellow('AWA Token')), false);
    const options: myAxiosConfig = {
      url: `https://${globalThis.awaHost}/control-center`,
      method: 'GET',
      headers: {
        ...this.headers,
        accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9'
      },
      Logger: logger
    };
    if (this.httpsAgent) options.httpsAgent = this.httpsAgent;
    return axios(options)
      .then(async (response) => {
        globalThis.secrets = [...new Set([...globalThis.secrets, ...Object.values(Cookie.ToJson(response.headers?.['set-cookie']))])];
        if (response.status === 200) {
          if (response.data.toLowerCase().includes('we have detected an issue with your network')) {
            ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.red(__('ipBanned')));
            return 610;
          }
          const $ = load(response.data);
          if ($('a.nav-link-login').length > 0) {
            ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.red(__('tokenExpired')));
            return 602;
          }
          ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.green('OK'));
          if (!this.userProfileUrl) {
            this.userProfileUrl = response.data.match(/user_profile_url.*?=.*?"(.+?)"/)?.[1];
          }
          return 200;
        }
        ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.red('Net Error'));
        return response.status;
      })
      .catch((error) => {
        ((error.config as myAxiosConfig)?.Logger || logger).log(chalk.red('Error(0)') + netError(error));
        globalThis.secrets = [...new Set([...globalThis.secrets, ...Object.values(Cookie.ToJson(error.response?.headers?.['set-cookie']))])];
        new Logger(error);
        return 0;
      });
  }
  async start(newArtifacts: Array<number>): Promise<boolean> {
    if (!await this.getArtifactsInfo()) {
      new Logger(`${time()}${chalk.red(__('changeArtifactsFailed'))}`);
      return false;
    }
    const oldArtifactsSet = new Set(this.oldArtifacts);
    const newArtifactsSet = new Set(newArtifacts);
    const diffArtifacts: Array<number> = newArtifacts.filter((artifact) => !oldArtifactsSet.has(artifact));
    const sameArtifactsIndex = this.oldArtifacts.filter((artifact) => newArtifactsSet.has(artifact)).map((artifact) => this.oldArtifacts.indexOf(artifact));
    if (diffArtifacts.length === 0) return true;

    const positions = [0, 1, 2].filter((index) => !sameArtifactsIndex.includes(index)).map((index) => index + 1);

    for (let index = 0; index < positions.length; index++) {
      await this.changeArtifact(diffArtifacts[index], positions[index]);
    }
    await this.getArtifactsInfo();
    if (this.oldArtifacts.filter((artifact) => !newArtifactsSet.has(artifact)).length === 0) {
      new Logger(`${time()}${chalk.green(__('changeArtifactsSuccess'))}`);
      try {
        await push(`${__('artifactsStatus')}\n[${this.oldArtifacts.join('|')}]\n\n${__('activePerks')}\n${this.activePerks}`);
      } catch (e) {
        new Logger(`${time()}${chalk.red(__('artifactsStatusPushFailed'))}`);
      }
      return true;
    }
    try {
      await push(`${__('artifactsStatusError')}\n[${this.oldArtifacts.join('|')}]\n\n${__('activePerks')}\n${this.activePerks}`);
    } catch (e) {
      new Logger(`${time()}${chalk.red(__('artifactsStatusPushFailed'))}`);
    }
    new Logger(`${time()}${chalk.red(__('changeArtifactsFailed'))}`);
    return false;
  }
  async getArtifactsInfo(): Promise<boolean> {
    if (!this.userProfileUrl) return false;
    const logger = new Logger(`${time()}${__('gettingArtifactsInfo')}`, false);
    const options: myAxiosConfig = {
      url: `https://${globalThis.awaHost}${this.userProfileUrl}/artifacts`,
      method: 'GET',
      headers: {
        ...this.headers,
        referer: `${globalThis.awaHost}`
      },
      Logger: logger
    };
    if (this.httpsAgent) options.httpsAgent = this.httpsAgent;
    return axios(options)
      .then((response) => {
        globalThis.secrets = [...new Set([...globalThis.secrets, ...Object.values(Cookie.ToJson(response.headers?.['set-cookie']))])];
        const { userActiveArtifacts } = JSON.parse(`{${response.data.match(/artifactsData.*?=.*?{(.+?)};/m)?.[1] || ''}}`) || {};
        if (userActiveArtifacts) {
          this.oldArtifacts = Object.values(userActiveArtifacts).map((artifact: any) => artifact.id);
          this.activePerks = Object.values(userActiveArtifacts).map((artifact: any) => `* ${artifact.perkTextShort}`).join('\n');
          ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.green('OK'));
          return true;
        }
        ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.red('Error(1)'));
        new Logger(response.data?.message || response);
        return false;
      })
      .catch((error) => {
        ((error.config as myAxiosConfig)?.Logger || logger).log(chalk.red('Error(0)'));
        globalThis.secrets = [...new Set([...globalThis.secrets, ...Object.values(Cookie.ToJson(error.response?.headers?.['set-cookie']))])];
        new Logger(error);
        return false;
      });
  }

  async changeArtifact(id: number, position: number): Promise<boolean> {
    const logger = new Logger(`${time()}${__('changingArtifact', chalk.blue(id), chalk.blue(position))}`, false);
    const options: myAxiosConfig = {
      url: `https://${globalThis.awaHost}/change-user-artifacts`,
      method: 'POST',
      headers: {
        ...this.headers,
        'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
        origin: `https://${globalThis.awaHost}`,
        referer: `https://${globalThis.awaHost}${this.userProfileUrl}/artifacts`
      },
      data: `{"artifactId":"${id}","position":"${position}"}`,
      Logger: logger
    };
    if (this.httpsAgent) options.httpsAgent = this.httpsAgent;

    return axios(options)
      .then((response) => {
        globalThis.secrets = [...new Set([...globalThis.secrets, ...Object.values(Cookie.ToJson(response.headers?.['set-cookie']))])];
        if (response.status === 200) {
          ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.green('OK'));
          return true;
        }
        ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.red('Error(1)'));
        new Logger(response.data?.message || response);
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

export { Artifacts };
