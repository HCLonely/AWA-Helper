/* eslint-disable max-len */
/* global __, proxy, logs, ws, webUI, myAxiosConfig, pusher, pushOptions, cookies */
import * as chalk from 'chalk';
import * as dayjs from 'dayjs';
import * as fs from 'fs-extra';
import * as os from 'os';
import * as crypto from 'crypto';
import axios, { AxiosError } from 'axios';
import * as tunnel from 'tunnel';
import { SocksProxyAgent, SocksProxyAgentOptions } from 'socks-proxy-agent';
import { parse } from 'yaml';
import { format, promisify } from 'util';
import { PushApi } from 'all-pusher-api';
import type { Interface } from 'readline';
import * as decompress from 'decompress';
import * as stream from 'stream';
import { spawn } from 'child_process';
import * as path from 'path';

globalThis.logs = { type: 'logs' };

const getSecertValue = (): Array<string> => {
  if (!fs.existsSync('config.yml')) {
    return ['______________'];
  }
  try {
    const {
      awaCookie,
      twitchCookie,
      asfPassword,
      proxy: {
        host,
        username,
        password
      },
      asfHost,
      autoLogin: {
        username: username1,
        password: password1
      }
    } = parse(fs.readFileSync('config.yml').toString());
    const secrets = ['______________'];
    secrets.push(...Object.values(Cookie.ToJson(awaCookie || '')));
    secrets.push(...Object.values(Cookie.ToJson(twitchCookie || '')));
    secrets.push(asfPassword, host, username, password, asfHost, username1, password1);
    return [...new Set(secrets)];
  } catch {
    return ['______________'];
  }
};
const hideSectets = (data: string): string => {
  globalThis.secrets.filter((secret) => secret && secret.length > 5).forEach((secret) => data = data.replaceAll(secret, '********'));
  return data;
};

globalThis.secrets = getSecertValue();

const toJSON = (e: any): string => {
  if (typeof e === 'string') {
    // eslint-disable-next-line no-control-regex
    return e.replace(/\x1B\[[\d]*?m/g, '');
  }

  return format(e);
};
const toHtmlJSON = (e: any): string => {
  if (typeof e === 'string') {
    // eslint-disable-next-line no-control-regex
    return hideSectets(e.replace(/\x1B\[90m(.+?)\x1B\[39m/g, '<font class="gray">$1</font>')
    // eslint-disable-next-line no-control-regex
      .replace(/\x1B\[31m(.+?)\x1B\[39m/g, '<font class="red">$1</font>')
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
      .replace(/\x1B\[32m(.+)/g, '<font class="green">$1</font>')
      // eslint-disable-next-line no-control-regex
      .replace(/\x1B\[33m(.+)/g, '<font class="yellow">$1</font>')
      // eslint-disable-next-line no-control-regex
      .replace(/\x1B\[34m(.+)/g, '<font class="blue">$1</font>')
      .replace(/\n/g, '</br>'));
  }

  return hideSectets(format(e));
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
      if (ws) {
        ws.send(JSON.stringify(logs.questInfo));
      }
      return;
    }
    fs.appendFileSync(`logs/${dayjs().format('YYYY-MM-DD')}.txt`, toJSON(data) + (newLine ? '\n' : ''));
    if (globalThis.log) {
      if (newLine)  {
        console.log(data);
      } else {
        process.stdout.write(data);
      }
    }
    this.data += data;
    logs[this.id.toString()] = {
      id: this.id,
      data: toHtmlJSON(this.data),
      type: 'log'
    };
    if (ws) {
      ws.send(JSON.stringify(logs[this.id.toString()]));
    }
  }
  static consoleLog(text: any, newLine = true): void {
    if (text.type === 'questInfo') {
      return;
    }
    fs.appendFileSync(`logs/${dayjs().format('YYYY-MM-DD')}.txt`, toJSON(text) + (newLine ? '\n' : ''));
    if (globalThis.log) {
      if (newLine) {
        console.log(text);
      } else {
        process.stdout.write(text);
      }
    }
  }
}

const sleep = (time: number): Promise<true> => new Promise((resolve) => {
  const timeout = setTimeout(() => {
    clearTimeout(timeout);
    resolve(true);
  }, time * 1000);
});

const random = (minNum: number, maxNum: number): number => Math.floor((Math.random() * (maxNum - minNum + 1)) + minNum);
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

/*
const formatProxy = (proxy: proxy): any => {
  const proxyOptions: AxiosProxyConfig = {
    protocol: proxy.protocol,
    host: proxy.host,
    port: proxy.port
  };
  if (proxy.username && proxy.password) {
    proxyOptions.auth = {
      username: proxy.username,
      password: proxy.password
    };
  }
  return proxyOptions;
};
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
  if (agent.options) {
    agent.options.rejectUnauthorized = false;
  }
  return agent;
};
/*
const retryAdapterEnhancer = (options: retryAdapterOptions): AxiosAdapter => {
  const { times = 0, delay = 300 } = options;

  return async (config: myAxiosConfig): Promise<AxiosResponse> => {
    const { retryTimes = times, retryDelay = delay } = config;
    let retryCount = 0;
    const request = async (config: myAxiosConfig): Promise<AxiosResponse> => {
      try {
        return await http(config);
      } catch (err) {
        if (!retryTimes || retryCount >= retryTimes) {
          return Promise.reject(err);
        }
        retryCount++;
        if (config.Logger) {
          config.Logger.log(chalk.red('Error'));
          config.Logger = new Logger(`${time()}${chalk.yellow(__('retrying', chalk.blue(retryCount)))}`, false);
        }
        const delay = new Promise((resolve) => {
          setTimeout(() => {
            resolve(true);
          }, retryDelay);
        });
        return delay.then(() => request(config));
      }
    };
    return request(config);
  };
};
*/
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

const checkUpdate = async (version: string, manager: boolean, autoUpdate: boolean, proxy?: proxy):Promise<void> => {
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
      if (latestVersion) {
        const currentVersionArr = version.replace('V', '').split('.').map((e) => parseInt(e, 10));
        const latestVersionArr = latestVersion.split('.').map((e: string) => parseInt(e, 10));
        if (
          latestVersionArr[0] > currentVersionArr[0] ||
          (latestVersionArr[0] === currentVersionArr[0] && latestVersionArr[1] > currentVersionArr[1]) ||
          (latestVersionArr[0] === currentVersionArr[0] && latestVersionArr[1] === currentVersionArr[1] && latestVersionArr[2] > currentVersionArr[2])
        ) {
          ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.green(__('newVersion', chalk.yellow(`V${latestVersion}`))));
          if (!autoUpdate || process.argv.includes('--no-update')) {
            new Logger(`${time()}${__('downloadLink', chalk.yellow(response.headers.location))}`);
            globalThis.newVersionNotice = `\n\n${__('newVersion', `V${latestVersion}`)}\n${__('downloadLink', response.headers.location)}`;
            return;
          }
          let arch = '';
          if (!/.*main\.js$/.test(process.argv[1])) {
            if (os.type() === 'Linux') {
              if (os.arch() === 'arm') {
                arch = '-armv7';
              } else if (os.arch() === 'arm64') {
                arch = '-armv8';
              } else if (os.arch() === 'x64') {
                arch = '-x64';
              }
            }
            await update(`${response.headers.location.replace('/tag/', '/download/')}/AWA-Helper-${os.type() === 'Windows_NT' ? 'Win' : `Linux${arch}`}.tar.gz`, manager, proxy);
          } else {
            await update(`${response.headers.location.replace('/tag/', '/download/')}/main.js`, manager, proxy);
          }
          return;
        }
        ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.green(__('noUpdate')));
        return;
      }
      ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.red('Failed'));
      return;
    })
    .catch((error) => {
      ((error.config as myAxiosConfig)?.Logger || logger).log(chalk.red('Error') + netError(error));
      globalThis.secrets = [...new Set([...globalThis.secrets, ...Object.values(Cookie.ToJson(error.response?.headers?.['set-cookie']))])];
      new Logger(error);
      return;
    });
};

async function downloadFile(link: string, proxy?: proxy): Promise<any> {
  const logger = new Logger(`${time()}${__('downloading')}`, false);
  const options: myAxiosConfig = {
    Logger: logger,
    responseType: 'stream'
  };
  if (proxy?.enable?.includes('github') && proxy.host && proxy.port) {
    options.httpsAgent = formatProxy(proxy);
  }
  if (!fs.existsSync('temp/')) {
    fs.mkdirSync('temp');
  }
  const finished = promisify(stream.finished);
  const writer = fs.createWriteStream('temp/AWA-Helper.tar.gz');
  return await http.get(link, options)
    .then(async (response) => {
      response.data.pipe(writer);
      ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.green(__('OK')));
      await finished(writer);
      return true;
    })
    .catch((error) => {
      ((error.config as myAxiosConfig)?.Logger || logger).log(chalk.red('Error') + netError(error));
      new Logger(error);
      writer.close();
      return;
    });
}

const update = async (link: string, manager: boolean, proxy?: proxy): Promise<void> => {
  if (!/.*main\.js$/.test(process.argv[1])) {
    if (!await downloadFile(link, proxy)) {
      return;
    }
    if (!fs.existsSync('temp/AWA-Helper.tar.gz')) {
      return;
    }
    const logger = new Logger(`${time()}${__('decompressing')}`, false);
    const decompressResult = await decompress('temp/AWA-Helper.tar.gz', 'temp/AWA-Helper')
      .then(() => {
        logger.log(chalk.green(__('OK')));
        return true;
      })
      .catch((error) => {
        logger.log(chalk.red('Error'));
        new Logger(error);
        return false;
      });
    if (!decompressResult) {
      return;
    }
    if (os.type() === 'Windows_NT') {
      fs.writeFileSync('temp/update.bat', `@echo off
cd "%~dp0"
taskkill /f /t /im AWA-Helper.exe
if exist ".\\AWA-Helper" (
echo Moving AWA-Helper...
xcopy /y /e "${path.resolve('./temp/AWA-Helper/output')}" "${path.resolve('./')}\\"
echo Success
)
cd ..
${
  // eslint-disable-next-line no-nested-ternary
  process.argv.includes('--update') ?
    '' :
    (manager ? 'start cmd /k "AWA-Helper.exe --manager --helper"' : 'start cmd /k "AWA-Helper.exe --helper --no-update"')}
rmdir /s /q temp
exit
`);
      const updater = spawn('start', [path.resolve('temp/update.bat')], { detached: true, shell: true, stdio: 'ignore' });
      updater.unref();
    } else if (os.type() === 'Linux') {
      fs.writeFileSync('temp/update.sh', `#!/bin/bash
sleep 5
cd ${path.resolve('./temp')}
kill -9 $(pidof AWA-Helper)
if [ -d "./AWA-Helper" ]; then
  echo Moving AWA-Helper...
  cp -rf ${path.resolve('./temp/AWA-Helper/output')}/* ${path.resolve('./')}
  echo Success
fi
cd ..
rm -rf temp
${
  // eslint-disable-next-line no-nested-ternary
  process.argv.includes('--update') ?
    '' :
    (manager ? './AWA-Helper --manager --helper' : './AWA-Helper --helper --no-update')}
`);
      const updater = spawn('bash', [path.resolve('temp/update.sh')], { detached: true, shell: true, stdio: 'ignore' });
      updater.unref();
    }
  } else {
    const logger = new Logger(`${time()}${__('downloadingMainJs')}`, false);
    const options: myAxiosConfig = {
      Logger: logger,
      responseType: 'text'
    };
    if (proxy?.enable?.includes('github') && proxy.host && proxy.port) {
      options.httpsAgent = formatProxy(proxy);
    }
    const mainJsMd5 = await http.get(link.replace('main.js', 'md5.txt'), options)
      .then(async (response) => response.data)
      .catch((error) => {
        ((error.config as myAxiosConfig)?.Logger || logger).log(chalk.red('Get MD5 Failed') + netError(error));
        new Logger(error);
        return;
      });
    if (!mainJsMd5) {
      return;
    }
    const result = await http.get(link, options)
      .then(async (response) => {
        const hash = crypto.createHash('md5');
        hash.update(response.data);
        const md5 = hash.digest('hex');
        if (md5 === mainJsMd5) {
          fs.writeFileSync('main.js', response.data);
          ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.green(__('OK')));
          return true;
        }
        ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.red(__('Error: MD5 not matched!')));
        return false;
      })
      .catch((error) => {
        ((error.config as myAxiosConfig)?.Logger || logger).log(chalk.red('Error') + netError(error));
        new Logger(error);
        return false;
      });
    if (result) {
      new Logger(`${time()}${chalk.green(__('updateSuccess'))}`);
    }
  }
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
  if (globalThis.pusherProxy) {
    pushOptions.config.proxy = globalThis.pusherProxy;
  }
  const result = await new PushApi([pushOptions])
    .send({ message });
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
  const otherTaskInfo = new Array(2);
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
      } else if (name === __('promotionalCalendar')) {
        otherTaskInfo[0] = [name, value];
      } else if (name === __('steamCommunityEvent')) {
        otherTaskInfo[1] = [name, value];
      } else {
        dailyTaskInfo.push([name, value]);
      }
    });
  const sortedTaskInfo = [...dailyTaskInfo, ...onlineTaskInfo, ...steamTaskInfo, ...otherTaskInfo].filter((e) => e);
  return `${__('dailyArp', globalThis.quest.dailyArp)}\n\n${
    globalThis.quest.signArp.daily ? __('dailySign', globalThis.quest.signArp.daily) : ''
  }${
    globalThis.quest.signArp.monthly ? __('monthlySign', globalThis.quest.signArp.monthly) : ''
  }---\n${
    sortedTaskInfo.map(
      ([name, value]) => {
        if (name === __('steamCommunityEvent')) {
          return `---\n${name}:  ${value[__('obtainedARP')]}/${value[__('maxAvailableARP')]}`;
        }
        if (name === __('promotionalCalendar')) {
          return `---\n${name}:  ${value[__('status')] === __('done') ? value[__('obtainedARP')] : value[__('status')]}`;
        }
        if (name === __('watchTwitch')) {
          return `${name}:  ${value[__('obtainedARP')]}${value[__('extraARP')] && value[__('extraARP')] !== '0' ? ` + ${value[__('extraARP')]}` : ''} ARP\n---`;
        }
        return `${name}:  ${value[__('obtainedARP')]}${value[__('extraARP')] && value[__('extraARP')] !== '0' ? ` + ${value[__('extraARP')]}` : ''} ARP`;
      })
      .join('\n')
  }`;
};

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

export { Logger, sleep, random, time, checkUpdate, netError, ask, http, formatProxy, push, pushQuestInfoFormat, Cookie };
