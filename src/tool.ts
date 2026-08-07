/*
 * @Author       : HCLonely
 * @Date         : 2025-07-18 09:14:52
 * @LastEditTime : 2025-09-01 09:42:07
 * @LastEditors  : HCLonely
 * @FilePath     : /AWA-Helper/src/tool.ts
 * @Description  :
 */
/* global __, proxy, logs, webUI, myAxiosConfig, pusher, pushOptions, cookies, managerServer */
import chalk from 'chalk';
import dayjs from 'dayjs';
import * as fs from 'fs-extra';
import axios, { AxiosError } from 'axios';
import * as tunnel from 'tunnel';
import { SocksProxyAgent, SocksProxyAgentOptions } from 'socks-proxy-agent';
import { PushApi } from 'all-pusher-api';
import type { Interface } from 'readline';
import { formatLogValue } from './core/logging/sanitize';

globalThis.logs = { type: 'logs' };
globalThis.wsClients = new Set();

const broadcastWebUi = (data: unknown): void => {
  const message = JSON.stringify(data);
  globalThis.wsClients.forEach((client) => {
    if (client.readyState !== 1) {
      globalThis.wsClients.delete(client);
      return;
    }
    try {
      client.send(message);
    } catch (_error) {
      globalThis.wsClients.delete(client);
    }
  });
};

const escapeHtml = (data: string): string => data
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll('\'', '&#39;');

globalThis.secrets = [];

const toJSON = (e: any): string => {
  if (typeof e === 'string') {
    return formatLogValue(e, true);
  }
  return formatLogValue(e, true);
};
const toHtmlJSON = (e: any): string => {
  if (typeof e === 'string') {
    const safeText = escapeHtml(formatLogValue(e));
    // eslint-disable-next-line no-control-regex
    return safeText.replace(/\x1B\[90m(.+?)\x1B\[39m/g, '<font class="gray">$1</font>')
    // eslint-disable-next-line no-control-regex
      .replace(/\x1B\[31m(.+?)\x1B\[39m/g, '<font class="red">$1</font>')
      // eslint-disable-next-line no-control-regex
      .replace(/\x1B\[1m(.+?)\x1B\[1m/g, '$1')
      // eslint-disable-next-line no-control-regex
      .replace(/\x1B\[22m(.+?)\x1B\[22m/g, '$1')
    // eslint-disable-next-line no-control-regex
      .replace(/\x1B\[32m(.+?)\x1B\[39m/g, '<font class="green">$1</font>')
    // eslint-disable-next-line no-control-regex
      .replace(/\x1B\[33m(.+?)\x1B\[39m/g, '<font class="yellow">$1</font>')
    // eslint-disable-next-line no-control-regex
      .replace(/\x1B\[34m(.+?)\x1B\[39m/g, '<font class="blue">$1</font>')
    // eslint-disable-next-line no-control-regex
      .replace(/\x1B\[90m(.+)/g, '<font class="gray">$1</font>')
      // eslint-disable-next-line no-control-regex
      .replace(/\x1B\[31m(.+)/g, '<font class="red">$1</font>')
      // eslint-disable-next-line no-control-regex
      .replace(/\x1B\[1m(.+)/g, '$1')
      // eslint-disable-next-line no-control-regex
      .replace(/\x1B\[22m(.+)/g, '$1')
      // eslint-disable-next-line no-control-regex
      .replace(/\x1B\[32m(.+)/g, '<font class="green">$1</font>')
      // eslint-disable-next-line no-control-regex
      .replace(/\x1B\[33m(.+)/g, '<font class="yellow">$1</font>')
      // eslint-disable-next-line no-control-regex
      .replace(/\x1B\[34m(.+)/g, '<font class="blue">$1</font>')
      .replace(/\n/g, '</br>');
  }

  return escapeHtml(formatLogValue(e));
};

class Logger {
  id = Date.now();
  data = '';

  constructor(text: any, newLine = true) {
    if (webUI) {
      this.log(text, newLine);
      return this;
    }
    Logger.consoleLog(text, newLine);
  }
  log(data: any, newLine = true): void {
    if (data.type === 'questInfo') {
      logs.questInfo = {
        id: this.id,
        data: data.data,
        type: 'questInfo'
      };
      broadcastWebUi(logs.questInfo);
      return;
    }
    fs.appendFileSync(`logs/${dayjs().format('YYYY-MM-DD')}.txt`, toJSON(data) + (newLine ? '\n' : ''));
    if (globalThis.log) {
      if (newLine)  {
        console.log(formatLogValue(data));
      } else {
        process.stdout.write(formatLogValue(data));
      }
    }
    this.data += data;
    logs[this.id.toString()] = {
      id: this.id,
      data: toHtmlJSON(this.data),
      type: 'log'
    };
    const logIds = Object.keys(logs).filter((id) => /^\d+$/.test(id));
    if (logIds.length > 1000) {
      logIds.slice(0, logIds.length - 1000).forEach((id) => delete logs[id]);
    }
    broadcastWebUi(logs[this.id.toString()]);
  }
  static consoleLog(text: any, newLine = true): void {
    if (text.type === 'questInfo') {
      return;
    }
    fs.appendFileSync(`logs/${dayjs().format('YYYY-MM-DD')}.txt`, toJSON(text) + (newLine ? '\n' : ''));
    if (globalThis.log) {
      if (newLine) {
        console.log(formatLogValue(text));
      } else {
        process.stdout.write(formatLogValue(text));
      }
    }
  }
}

const sleep = (time: number, signal?: AbortSignal): Promise<boolean> => new Promise((resolve) => {
  if (signal?.aborted) {
    resolve(false);
    return;
  }
  let settled = false;
  const finish = (result: boolean): void => {
    if (settled) return;
    settled = true;
    clearTimeout(timeout);
    signal?.removeEventListener('abort', onAbort);
    resolve(result);
  };
  const onAbort = (): void => finish(false);
  const timeout = setTimeout(() => finish(true), time * 1000);
  signal?.addEventListener('abort', onAbort, { once: true });
});

const random = (minNum: number, maxNum: number): number => Math.floor((Math.random() * (maxNum - minNum + 1)) + minNum);
const time = (): string => chalk.gray(`[${dayjs().format('YYYY-MM-DD HH:mm:ss')}] `);
const netError = (error: AxiosError): string => {
  if (error.message.includes('ETIMEDOUT')) {
    return `: ${chalk.yellow(__('timeout'))}`;
  }
  if (error.message.includes('ECONNREFUSED')) {
    return `: ${chalk.yellow(__('connRefused'))}`;
  }
  if (error.message.includes('hang up') || error.message.includes('ECONNRESET')) {
    return `: ${chalk.yellow(__('connReset'))}`;
  }
  if (error.message.includes('certificate') || error.message.includes('TLS') || error.message.includes('SSL')) {
    return `: ${chalk.yellow(__('certificateError'))}`;
  }
  if (error.message.includes('Maximum number of redirects exceeded') && error?.config?.url?.includes('alienwarearena.com')) {
    const host = (error.config.headers?.cookie as string)?.match(/home_site=(.*?);/)?.[1];
    if (host) {
      return `: ${chalk.yellow(__('changeAwaHostAlert2', chalk.red('awaHost'), chalk.green('host')))}`;
    }
    return `: ${chalk.yellow(__('changeAwaHostAlert1', chalk.red('awaHost')))}`;
  }
  return '';
};

const formatProxy = (proxy: proxy): any => {
  let agent: any;
  const proxyOptions: tunnel.ProxyOptions & SocksProxyAgentOptions = {
    host: proxy.host,
    port: proxy.port
  };

  if (proxy.protocol?.includes('socks')) {
    proxyOptions.hostname = proxy.host;
    if (proxy.username && proxy.password) {
      proxyOptions.userId = proxy.username;
      proxyOptions.password = proxy.password;
    }
    agent = new SocksProxyAgent(proxyOptions);
  } else if (proxy.protocol === 'http') {
    if (proxy.username && proxy.password) {
      proxyOptions.proxyAuth = `${proxy.username}:${proxy.password}`;
    }
    agent = tunnel.httpsOverHttp({
      proxy: proxyOptions
    });
  } else if (proxy.protocol === 'https') {
    if (proxy.username && proxy.password) {
      proxyOptions.proxyAuth = `${proxy.username}:${proxy.password}`;
    }
    agent = tunnel.httpsOverHttps({
      proxy: proxyOptions
    });
  }
  return agent;
};

const http = axios.create({
  maxRedirects: 5,
  timeout: 5 * 60 * 1000
});
http.interceptors.response.use(
  (response) => response,
  async (error) => {
    const { config, response } = error;
    if (!config) return Promise.reject(error);

    const method = (config.method || 'get').toUpperCase();
    const status = response?.status as number | undefined;
    const retryableMethod = ['GET', 'HEAD', 'OPTIONS'].includes(method);
    const retryableFailure = !status || [408, 429, 502, 503, 504].includes(status);
    if (!retryableMethod || !retryableFailure) {
      return Promise.reject(error);
    }

    config.retryCount = config.retryCount || 0;
    if (config.retryCount >= (config.retryTimes || 3)) {
      return Promise.reject(error);
    }

    config.retryCount++;
    if (config.Logger) {
      config.Logger.log(chalk.red('Error'));
      config.Logger = new Logger(`${time()}${chalk.yellow(__('retrying', chalk.blue(config.retryCount)))}`, false);
    }
    const retryAfter = Number.parseInt(response?.headers?.['retry-after'] || '', 10);
    const exponentialDelay = Math.min((config.retryDelay || 1000) * (2 ** (config.retryCount - 1)), 30 * 1000);
    const delay = Number.isFinite(retryAfter) ? retryAfter * 1000 : exponentialDelay + Math.floor(Math.random() * 250);
    const delayHttp = new Promise((resolve) => {
      setTimeout(() => {
        resolve(true);
      }, delay);
    });
    await delayHttp;
    return await http(config);
  }
);

const checkUpdate = async (version: string, _managerServer: managerServer | undefined, autoUpdate: boolean, CHANGELOG: string, proxy?: proxy): Promise<void> => {
  const logger = new Logger(`${time()}${__('checkingUpdating')}`, false);
  const options: myAxiosConfig = {
    validateStatus: (status: number) => status === 302,
    maxRedirects: 0,
    Logger: logger
  };

  if (proxy?.enable?.includes('github') && proxy.host && proxy.port) {
    options.httpsAgent = formatProxy(proxy);
  }

  return await http.head('https://github.com/HCLonely/AWA-Helper/releases/latest', options)
    .then(async (response) => {
      globalThis.secrets = [...new Set([...globalThis.secrets, ...Object.values(Cookie.ToJson(response.headers?.['set-cookie']))])];
      const latestVersion = response?.headers?.location?.match(/tag\/v?([\d.]+)/)?.[1];

      if (!latestVersion) {
        ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.red('Failed'));
        return;
      }

      if (isNewVersion(version, latestVersion)) {
        ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.green(__('newVersion', chalk.yellow(`V${latestVersion}`))));

        if (autoUpdate && !process.argv.includes('--no-update')) {
          new Logger(time() + chalk.yellow('Automatic installation is disabled until signed updates are available.'));
        }
        new Logger(`${time()}${__('downloadLink', chalk.yellow(response.headers.location))}`);
        globalThis.newVersionNotice = `\n\n${__('newVersion', `V${latestVersion}`)}\n${__('downloadLink', response.headers.location)}`;
        return;
      }

      if (process.argv.includes('--no-update')) {
        await push(`${__('pushTitle')}:\n\n${__('autoUpdated', version)}\n\n${__('updateLog')}\n${CHANGELOG}`);
      }

      ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.green(__('noUpdate')));
      return;
    })
    .catch((error) => {
      ((error.config as myAxiosConfig)?.Logger || logger).log(chalk.red('Error') + netError(error));
      globalThis.secrets = [...new Set([...globalThis.secrets, ...Object.values(Cookie.ToJson(error.response?.headers?.['set-cookie']))])];
      new Logger(error);
      return;
    });
};

const isNewVersion = (currentVersion: string, latestVersion: string): boolean => {
  const currentVersionArr = currentVersion.replace('V', '').split('.').map((e) => parseInt(e, 10));
  const latestVersionArr = latestVersion.split('.').map((e: string) => parseInt(e, 10));

  return (
    latestVersionArr[0] > currentVersionArr[0] ||
    (latestVersionArr[0] === currentVersionArr[0] && latestVersionArr[1] > currentVersionArr[1]) ||
    (latestVersionArr[0] === currentVersionArr[0] && latestVersionArr[1] === currentVersionArr[1] && latestVersionArr[2] > currentVersionArr[2])
  );
};

const ask = (rl: Interface, question: string, answers?: Array<string>): Promise<string> => new Promise((resolve) => {
  rl.question(`${question}`, (chunk) => {
    const answer = chunk.toString().trim();
    if ((answers && !answers.includes(answer)) || !answer) {
      return resolve(ask(rl, question, answers));
    }
    return resolve(answer);
  });
});

const push = async (message: string) => {
  if (!globalThis.pusher?.enable) {
    return;
  }
  const logger = new Logger(`${time()}${__('pushing')}`, false);
  const pushOptions: pushOptions = {
    name: (pusher as pusher).platform,
    config: {
      key: (pusher as pusher).key
    }
  };
  if ((pusher as pusher).options) {
    pushOptions.config.options = (pusher as pusher).options;
  }
  if (globalThis.pusherProxy) {
    pushOptions.config.proxy = globalThis.pusherProxy;
  }
  const result = await new PushApi([pushOptions])
    .send({ message, title: __('pushTitle'), type: 'text' });
  if ((result[0].result?.status || 0) >= 200 && result[0].result.status < 300) {
    logger.log(chalk.green(__('pushSuccess')));
    return;
  }
  logger.log(chalk.red(__('pushFailed')));
  new Logger(result[0].result);
};

const pushQuestInfoFormat = () => {
  if (!globalThis.quest?.formatQuestInfo) {
    return '';
  }
  const otherTaskInfo = new Array(1);
  const dailyTaskInfo: Array<any> = [];
  const onlineTaskInfo = new Array(2);
  const steamTaskInfo: Array<any> = [];
  Object.entries(globalThis.quest.formatQuestInfo()).forEach(
    ([name, value]) => {
      if (name === __('timeOnSite')) {
        onlineTaskInfo[0] = [name, value];
      } else if (name === __('watchTwitch')) {
        onlineTaskInfo[1] = [name, value];
      } else if (name.includes(__('steamQuest'))) {
        steamTaskInfo.push([name, value]);
      } else if (name.includes(__('promotionalCalendar'))) {
        otherTaskInfo.push([name, value]);
      } else if (name === __('steamCommunityEvent')) {
        otherTaskInfo[0] = [name, value];
      } else {
        dailyTaskInfo.push([name, value]);
      }
    });
  const sortedTaskInfo = [...dailyTaskInfo, ...onlineTaskInfo, ...steamTaskInfo, ...otherTaskInfo].filter((e) => e);
  return `👉${__('dailyArp', globalThis.quest.dailyArp)}\n\n${
    globalThis.quest.signArp.daily ? `✔️${__('dailySign', globalThis.quest.signArp.daily)}` : `⚠️${__('dailySign', '-')}`
  }${
    globalThis.quest.signArp.monthly ? `✔️${__('monthlySign', globalThis.quest.signArp.monthly)}` : `⚠️${__('dailySign', '-')}`
  }---\n${
    sortedTaskInfo.map(
      ([name, value]) => {
        if (name === __('steamCommunityEvent')) {
          return `---\n${parseInt(value[__('obtainedARP')], 10) >= parseInt(value[__('maxAvailableARP')], 10) ? '✔️' : '⚠️'}${name}:  ${value[__('obtainedARP')]}/${value[__('maxAvailableARP')]}\n---`;
        }
        if (name.includes(__('promotionalCalendar'))) {
          return `---\n${value[__('status')] === __('done') ? '✔️' : '⚠️'}${name}:  ${value[__('status')] === __('done') ? value[__('obtainedARP')] : value[__('status')]}`;
        }
        if (name === __('watchTwitch')) {
          return `${value[__('status')] === __('done') ? '✔️' : '❌'}${name}:  ${value[__('obtainedARP')]}${value[__('extraARP')] && value[__('extraARP')] !== '0' ? ` + ${value[__('extraARP')]}` : ''} ARP\n---`;
        }
        if (name === __('timeOnSite')) {
          return `---\n${value[__('status')] === __('done') ? '✔️' : '❌'}${name}:  ${value[__('obtainedARP')]}${value[__('extraARP')] && value[__('extraARP')] !== '0' ? ` + ${value[__('extraARP')]}` : ''} ARP`;
        }
        return `${value[__('status')] === __('done') ? '✔️' : '❌'}${name}:  ${value[__('obtainedARP')]}${value[__('extraARP')] && value[__('extraARP')] !== '0' ? ` + ${value[__('extraARP')]}` : ''} ARP`;
      })
      .join('\n')
  }`;
};

class Cookie {
  cookie: cookies;

  static ToJson(data: string | Array<string> | null | undefined): cookies {
    if (typeof data === 'string') {
      return Object.fromEntries(data.split(';').flatMap((cookieText) => {
        const cookie = cookieText.trim();
        const separator = cookie.indexOf('=');
        if (separator <= 0) return [];
        return [[cookie.slice(0, separator).trim(), cookie.slice(separator + 1).trim()]];
      }));
    }
    if (Array.isArray(data)) {
      return Object.fromEntries(data.map((ck) => Object.entries(this.ToJson(ck.split(';')[0]))[0]));
    }
    return {};
  }
  static ToString(data: object | Array<string>): string {
    if (Array.isArray(data)) {
      data = this.ToJson(data);
    }
    if (typeof data === 'object') {
      return Object.entries(data).map(([name, value]) => `${name}=${value}`).join(';');
    }
    return '';
  }

  constructor(data?: string | Array<string> | { [name: string]: string }) {
    if (typeof data === 'string' || Array.isArray(data)) {
      this.cookie = Cookie.ToJson(data);
      return;
    }
    if (typeof data === 'object') {
      this.cookie = data;
      return;
    }
    this.cookie = {};
  }
  parse() {
    return this.cookie;
  }
  stringify() {
    return Cookie.ToString(this.cookie);
  }
  browserify() {
    return Object.entries(this.cookie).map(([name, value]) => ({
      name,
      value,
      domain: '.alienwarearena.com',
      path: '/'
    }));
  }
  update(data: string | Array<string> | cookies) {
    if (typeof data === 'string' || Array.isArray(data)) {
      data = Cookie.ToJson(data);
    }
    this.cookie = {
      ...this.cookie,
      ...data
    };
    return this;
  }
  remove(name: string) {
    if (this.cookie[name]) {
      delete this.cookie[name];
    }
    return this;
  }
  get(name: string): string | null {
    return this.cookie[name];
  }
}

export { Logger, sleep, random, time, checkUpdate, netError, ask, http, formatProxy, push, pushQuestInfoFormat, Cookie };
