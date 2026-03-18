/*
 * @Author       : HCLonely
 * @Date         : 2025-07-18 09:14:52
 * @LastEditTime : 2026-01-08 18:53:46
 * @LastEditors  : HCLonely
 * @FilePath     : /AWA-Helper/src/Archievement/tool.ts
 * @Description  : 工具函数
 */
/* eslint-disable no-nested-ternary */
/* global __, proxy, cookies */
import * as chalk from 'chalk';
import * as dayjs from 'dayjs';
import * as fs from 'fs-extra';
import axios, { AxiosError } from 'axios';
import * as tunnel from 'tunnel';
import { SocksProxyAgent, SocksProxyAgentOptions } from 'socks-proxy-agent';
import { format } from 'util';

const toJSON = (e: any): string => {
  if (typeof e === 'string') {
    // eslint-disable-next-line no-control-regex
    return e.replace(/\x1B\[[\d]*?m/g, '');
  }

  return format(e);
};

class Logger {
  id = Date.now();
  data = '';
  constructor(text: any, newLine = true) {
    Logger.consoleLog(text, newLine);
  }
  log(data: any, newLine = true): void {
    fs.appendFileSync(`logs/Archievement-${dayjs().format('YYYY-MM-DD')}.txt`, toJSON(data) + (newLine ? '\n' : ''));
    if (newLine) console.log(data);
    else process.stdout.write(data);
  }
  static consoleLog(text: any, newLine = true): void {
    fs.appendFileSync(`logs/Archievement-${dayjs().format('YYYY-MM-DD')}.txt`, toJSON(text) + (newLine ? '\n' : ''));
    if (newLine) console.log(text);
    else process.stdout.write(text);
  }
}

const sleep = (time: number): Promise<true> => new Promise((resolve) => {
  const timeout = setTimeout(() => {
    clearTimeout(timeout);
    resolve(true);
  }, time * 1000);
});

const time = (): string => chalk.gray(`[${dayjs().format('YYYY-MM-DD HH:mm:ss')}] `);
// eslint-disable-next-line
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
  if (agent.options) {
    agent.options.rejectUnauthorized = false;
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
    const { config } = error;
    if (!config) return Promise.reject(error);

    config.retryCount = config.retryCount || 0;
    if (config.retryCount >= (config.times || 3)) {
      return Promise.reject(error);
    }

    config.retryCount++;
    if (config.Logger) {
      config.Logger.log(chalk.red('Error'));
      config.Logger = new Logger(`${time()}${chalk.yellow(__('retrying', chalk.blue(config.retryCount)))}`, false);
    }
    const delayHttp = new Promise((resolve) => {
      setTimeout(() => {
        resolve(true);
      }, config.delay || 1000);
    });
    await delayHttp;
    return await http(config);
  }
);

class Cookie {
  cookie: cookies;

  static ToJson(data: string | Array<string> | null | undefined): cookies {
    if (typeof data === 'string') {
      return Object.fromEntries(data.split(';').filter((cookies) => cookies.trim()).map((cookies) => cookies.trim().split('=').map(((str) => str.trim()))));
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

export { Logger, sleep, time, netError, http, formatProxy, Cookie };
