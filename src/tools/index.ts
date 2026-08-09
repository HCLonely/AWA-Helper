/**
 * @file src/tools/index.ts
 * @description 实现日志输出、HTTP 请求、Cookie、代理、通知、版本检查和通用时间工具。
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
import { formatLogValue } from './logging/sanitize';

globalThis.logs = { type: 'logs' };
globalThis.wsClients = new Set();

/**
 * 处理 broadcast Web Ui 相关逻辑。
 * @param data - 当前请求或操作使用的数据内容，类型为 `unknown`。
 * @returns `void`，该函数仅执行副作用，不返回值。
 */
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

/**
 * 处理 escape Html 相关逻辑。
 * @param data - 当前请求或操作使用的数据内容，类型为 `string`。
 * @returns `string`，escapeHtml 获取或生成的文本内容。
 */
const escapeHtml = (data: string): string => data
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll('\'', '&#39;');

globalThis.secrets = [];

/**
 * 处理 to JSON 相关逻辑。
 * @param e - 需要序列化或格式化的原始值，类型为 `any`。
 * @returns `string`，toJSON 获取或生成的文本内容。
 */
const toJSON = (e: any): string => {
  if (typeof e === 'string') {
    return formatLogValue(e, true);
  }
  return formatLogValue(e, true);
};
/**
 * 处理 to Html JSON 相关逻辑。
 * @param e - 需要序列化或格式化的原始值，类型为 `any`。
 * @returns `string`，toHtmlJSON 获取或生成的文本内容。
 */
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

  /**
   * 初始化 Logger 实例。
   * @param text - 需要记录、推送或格式化的文本内容，类型为 `any`。
   * @param newLine - 用于决定输出后是否追加换行符，类型为 `boolean`。
   */
  constructor(text: any, newLine = true) {
    if (webUI) {
      this.log(text, newLine);
      return this;
    }
    Logger.consoleLog(text, newLine);
  }
  /**
   * 处理 log 相关逻辑。
   * @param data - 当前请求或操作使用的数据内容，类型为 `any`。
   * @param newLine - 用于决定输出后是否追加换行符，类型为 `boolean`。
   * @returns `void`，该函数仅执行副作用，不返回值。
   */
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
  /**
   * 处理 console Log 相关逻辑。
   * @param text - 需要记录、推送或格式化的文本内容，类型为 `any`。
   * @param newLine - 用于决定输出后是否追加换行符，类型为 `boolean`。
   * @returns `void`，该函数仅执行副作用，不返回值。
   */
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

/**
 * 等待 sleep 相关数据。
 * @param time - 计算或比较时使用的时间，类型为 `number`。
 * @param signal - 用于取消当前异步操作的中止信号，类型为 `AbortSignal | undefined`。
 * @returns `Promise<boolean>`，表示 sleep 检查是否通过。
 */
const sleep = (time: number, signal?: AbortSignal): Promise<boolean> => new Promise((resolve) => {
  if (signal?.aborted) {
    resolve(false);
    return;
  }
  let settled = false;
  /**
   * 处理 finish 相关逻辑。
   * @param result - 上一处理步骤产生的响应结果，类型为 `boolean`。
   * @returns `void`，该函数仅执行副作用，不返回值。
   */
  const finish = (result: boolean): void => {
    if (settled) return;
    settled = true;
    clearTimeout(timeout);
    signal?.removeEventListener('abort', onAbort);
    resolve(result);
  };
    /**
     * 处理 on Abort 相关逻辑。
     * @returns `void`，该函数仅执行副作用，不返回值。
     */
  const onAbort = (): void => finish(false);
  const timeout = setTimeout(() => finish(true), time * 1000);
  signal?.addEventListener('abort', onAbort, { once: true });
});

/**
 * 处理 random 相关逻辑。
 * @param minNum - 随机数可取的最小整数，类型为 `number`。
 * @param maxNum - 随机数可取的最大整数，类型为 `number`。
 * @returns `number`，random 计算或读取到的数值。
 */
const random = (minNum: number, maxNum: number): number => Math.floor((Math.random() * (maxNum - minNum + 1)) + minNum);
/**
 * 处理 time 相关逻辑。
 * @returns `string`，time 获取或生成的文本内容。
 */
const time = (): string => chalk.gray(`[${dayjs().format('YYYY-MM-DD HH:mm:ss')}] `);
/**
 * 处理 net Error 相关逻辑。
 * @param error - 需要处理或转换的异常对象，类型为 `AxiosError<unknown, any, any>`。
 * @returns `string`，netError 获取或生成的文本内容。
 */
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

/**
 * 格式化 format Proxy 相关数据。
 * @param proxy - 连接远程服务时使用的代理配置，类型为 `proxy`。
 * @returns `any`，formatProxy 生成的格式化结果。
 */
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

/**
 * 检查 check Update 相关数据。
 * @param version - 用于比较或展示的应用版本号，类型为 `string`。
 * @param _managerServer - 兼容旧调用方式而保留的 Manager 服务配置，类型为 `managerServer | undefined`。
 * @param autoUpdate - 是否在发现新版本后自动执行更新，类型为 `boolean`。
 * @param CHANGELOG - 用于展示版本变更内容的更新日志文本，类型为 `string`。
 * @param proxy - 连接远程服务时使用的代理配置，类型为 `proxy | undefined`。
 * @returns `Promise<void>`，异步操作完成后兑现，不携带结果值。
 */
const checkUpdate = async (version: string, _managerServer: managerServer | undefined, autoUpdate: boolean, CHANGELOG: string, proxy?: proxy): Promise<void> => {
  const logger = new Logger(`${time()}${__('checkingUpdating')}`, false);
  const options: myAxiosConfig = {
    /**
     * 检查 validate Status 相关数据。
     * @param status - 当前对象或任务的状态，类型为 `number`。
     * @returns `boolean`，表示 validateStatus 检查是否通过。
     */
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

/**
 * 检查 is New Version 相关数据。
 * @param currentVersion - 用于比较或展示的应用版本号，类型为 `string`。
 * @param latestVersion - 用于比较或展示的应用版本号，类型为 `string`。
 * @returns `boolean`，表示 isNewVersion 检查是否通过。
 */
const isNewVersion = (currentVersion: string, latestVersion: string): boolean => {
  const currentVersionArr = currentVersion.replace('V', '').split('.').map((e) => parseInt(e, 10));
  const latestVersionArr = latestVersion.split('.').map((e: string) => parseInt(e, 10));

  return (
    latestVersionArr[0] > currentVersionArr[0] ||
    (latestVersionArr[0] === currentVersionArr[0] && latestVersionArr[1] > currentVersionArr[1]) ||
    (latestVersionArr[0] === currentVersionArr[0] && latestVersionArr[1] === currentVersionArr[1] && latestVersionArr[2] > currentVersionArr[2])
  );
};

/**
 * 处理 ask 相关逻辑。
 * @param rl - 读取终端输入所用的 Readline 接口，类型为 `Interface`。
 * @param question - 向用户显示的提问文本，类型为 `string`。
 * @param answers - 允许用户选择的候选答案列表，类型为 `string[] | undefined`。
 * @returns `Promise<string>`，ask 获取或生成的文本内容。
 */
const ask = (rl: Interface, question: string, answers?: Array<string>): Promise<string> => new Promise((resolve) => {
  rl.question(`${question}`, (chunk) => {
    const answer = chunk.toString().trim();
    if ((answers && !answers.includes(answer)) || !answer) {
      return resolve(ask(rl, question, answers));
    }
    return resolve(answer);
  });
});

/**
 * 处理 push 相关逻辑。
 * @param message - 需要记录、推送或格式化的文本内容，类型为 `string`。
 * @returns `Promise<void>`，异步操作完成后兑现，不携带结果值。
 */
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

/**
 * 处理 push Quest Info Format 相关逻辑。
 * @param quest - 需要格式化、上报或执行的任务信息，类型为 `{ report: Record<string, any>; dailyArp: string; signArp: { daily?: string; monthly?: string; }; } | undefined`。
 * @returns `string`，pushQuestInfoFormat 获取或生成的文本内容。
 */
const pushQuestInfoFormat = (quest?: { report: Record<string, any>; dailyArp: string; signArp: { daily?: string; monthly?: string } }) => {
  if (!quest) {
    return '';
  }
  const otherTaskInfo = new Array(1);
  const dailyTaskInfo: Array<any> = [];
  const onlineTaskInfo = new Array(2);
  const steamTaskInfo: Array<any> = [];
  Object.entries(quest.report).forEach(
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
  return `👉${__('dailyArp', quest.dailyArp)}\n\n${
    quest.signArp.daily ? `✔️${__('dailySign', quest.signArp.daily)}` : `⚠️${__('dailySign', '-')}`
  }${
    quest.signArp.monthly ? `✔️${__('monthlySign', quest.signArp.monthly)}` : `⚠️${__('dailySign', '-')}`
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

  /**
   * 处理 To Json 相关逻辑。
   * @param data - 当前请求或操作使用的数据内容，类型为 `string | string[] | null | undefined`。
   * @returns `cookies`，将当前 Cookie 集合转换得到的键值对象。
   */
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
  /**
   * 处理 To String 相关逻辑。
   * @param data - 当前请求或操作使用的数据内容，类型为 `object | string[]`。
   * @returns `string`，ToString 获取或生成的文本内容。
   */
  static ToString(data: object | Array<string>): string {
    if (Array.isArray(data)) {
      data = this.ToJson(data);
    }
    if (typeof data === 'object') {
      return Object.entries(data).map(([name, value]) => `${name}=${value}`).join(';');
    }
    return '';
  }

  /**
   * 初始化 Cookie 实例。
   * @param data - 当前请求或操作使用的数据内容，类型为 `string | string[] | { [name: string]: string; } | undefined`。
   */
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
  /**
   * 解析 parse 相关数据。
   * @returns `cookies`，parse 解析得到的结构化结果。
   */
  parse() {
    return this.cookie;
  }
  /**
   * 处理 stringify 相关逻辑。
   * @returns `string`，stringify 获取或生成的文本内容。
   */
  stringify() {
    return Cookie.ToString(this.cookie);
  }
  /**
   * 处理 browserify 相关逻辑。
   * @returns `{ name: string; value: string; domain: string; path: string; }[]`，browserify 收集或筛选得到的数据列表。
   */
  browserify() {
    return Object.entries(this.cookie).map(([name, value]) => ({
      name,
      value,
      domain: '.alienwarearena.com',
      path: '/'
    }));
  }
  /**
   * 更新 update 相关数据。
   * @param data - 当前请求或操作使用的数据内容，类型为 `string | string[] | cookies`。
   * @returns `this`，update 操作完成后的结果。
   */
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
  /**
   * 删除 remove 相关数据。
   * @param name - 用于定位目标对象的名称，类型为 `string`。
   * @returns `this`，remove 操作完成后的结果。
   */
  remove(name: string) {
    if (this.cookie[name]) {
      delete this.cookie[name];
    }
    return this;
  }
  /**
   * 获取 get 相关数据。
   * @param name - 用于定位目标对象的名称，类型为 `string`。
   * @returns `string | null`，get 获取到的数据。
   */
  get(name: string): string | null {
    return this.cookie[name];
  }
}

export { Logger, sleep, random, time, checkUpdate, netError, ask, http, formatProxy, push, pushQuestInfoFormat, Cookie };
