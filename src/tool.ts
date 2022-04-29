/* global proxy */
import * as chalk from 'chalk';
import * as dayjs from 'dayjs';
import * as fs from 'fs';
import axios, { AxiosAdapter, AxiosRequestConfig, AxiosResponse } from 'axios';
import * as tunnel from 'tunnel';
import { SocksProxyAgent, SocksProxyAgentOptions } from 'socks-proxy-agent';

const log = (text: string, newLine = true): void => {
  // eslint-disable-next-line no-control-regex
  fs.appendFileSync('log.txt', text.toString().replace(/\x1B\[[\d]*?m/g, '') + (newLine ? '\n' : ''));
  if (newLine) console.log(text);
  else process.stdout.write(text);
};

const sleep = (time: number): Promise<true> => new Promise((resolve) => {
  const timeout = setTimeout(() => {
    clearTimeout(timeout);
    resolve(true);
  }, time * 1000);
});

const random = (minNum: number, maxNum: number): number => Math.floor((Math.random() * (maxNum - minNum + 1)) + minNum);
const time = (): string => chalk.gray(`[${dayjs().format('YYYY-MM-DD HH:mm:ss')}] `);
// eslint-disable-next-line
const netError = (error: Error) => {
  if (error.message.includes('ETIMEDOUT')) {
    return `: ${chalk.yellow('连接超时，请尝试更换代理！')}`;
  }
  if (error.message.includes('ECONNREFUSED')) {
    return `: ${chalk.yellow('连接被拒绝，请尝试更换代理！')}`;
  }
  if (error.message.includes('hang up') || error.message.includes('ECONNRESET')) {
    return `: ${chalk.yellow('连接被重置，请尝试更换代理！')}`;
  }
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

interface retryAdapterOptions {
  times?: number
  delay?: number
}
interface myAxiosConfig extends AxiosRequestConfig {
  retryTimes?: number
  retryDelay?: number
}
const retryAdapterEnhancer = (adapter: AxiosAdapter, options: retryAdapterOptions): AxiosAdapter => {
  const { times = 0, delay = 300 } = options;

  return async (config: myAxiosConfig): Promise<AxiosResponse> => {
    const { retryTimes = times, retryDelay = delay } = config;
    let retryCount = 0;
    const request = async (): Promise<AxiosResponse> => {
      try {
        return await adapter(config);
      } catch (err) {
        if (!retryTimes || retryCount >= retryTimes) {
          return Promise.reject(err);
        }
        retryCount++;
        log(chalk.red('Error'));
        log(`${time()}${chalk.yellow(`正在重试第 ${chalk.blue(retryCount)} 次...`)}`, false);
        const delay = new Promise((resolve) => {
          setTimeout(() => {
            resolve(true);
          }, retryDelay);
        });
        return delay.then(() => request());
      }
    };
    return request();
  };
};

const http = axios.create({
  adapter: retryAdapterEnhancer(axios.defaults.adapter as AxiosAdapter, {
    delay: 1000,
    times: 3
  })
});

const checkUpdate = async (version: string, proxy?: proxy):Promise<void> => {
  log(`${time()}正在检测更新...`, false);
  const options: AxiosRequestConfig = {
    validateStatus: (status: number) => status === 302,
    maxRedirects: 0
  };
  if (proxy?.enable?.includes('github') && proxy.host && proxy.port) {
    options.httpsAgent = formatProxy(proxy);
  }
  return await http.head('https://github.com/HCLonely/AWA-Helper/releases/latest', options)
    .then((response) => {
      const latestVersion = response.headers.location.match(/tag\/v([\d.]+)/)?.[1];
      if (latestVersion) {
        const currentVersionArr = version.replace('V', '').split('.').map((e) => parseInt(e, 10));
        const latestVersionArr = latestVersion.split('.').map((e) => parseInt(e, 10));
        if (
          latestVersionArr[0] > currentVersionArr[0] ||
          (latestVersionArr[0] === currentVersionArr[0] && latestVersionArr[1] > currentVersionArr[1]) ||
          (latestVersionArr[0] === currentVersionArr[0] && latestVersionArr[1] === currentVersionArr[1] && latestVersionArr[2] > currentVersionArr[2])
        ) {
          log(chalk.green('检测到最新版 ') + chalk.yellow(`V${latestVersion}`));
          log(`${time()}最新版下载地址: ${chalk.yellow(response.headers.location)}`);
          return;
        }
        log(chalk.green('当前为最新版！'));
        return;
      }
      log(chalk.red('Failed'));
      return;
    })
    .catch((error) => {
      log(chalk.red('Error') + netError(error));
      console.error(error);
      return;
    });
};

const ask = (question: string, answers?: Array<string>): Promise<string> => new Promise((resolve) => {
  process.stdout.write(`${question}\n`);
  process.stdin.resume();
  process.stdin.setEncoding('utf-8');
  process.stdin.on('data', async (chunk) => {
    const answer = chunk.toString().trim();
    if (answers) {
      if (!answers.includes(answer)) {
        return resolve(await ask(question, answers));
      }
    }
    return resolve(answer);
  });
});

export { log, sleep, random, time, checkUpdate, netError, ask, http, formatProxy };
