/* global  __, pusher */
import * as chalk from 'chalk';
import * as dayjs from 'dayjs';
import * as fs from 'fs';
import { format } from 'util';
import axios from 'axios';
import { PushApi } from 'all-pusher-api';

interface pushOptions {
  name: string
  config: {
    key: {
      [name: string]: any
    }
    options?: {
      [name: string]: any
    }
    proxy?: {
      enable: Array<string>
      host: string
      port: number
      protocol ?: string
      username ?: string
      password ?: string
    }
  }
}
interface pusher {
  enable: boolean
  platform: string
  key: {
    [name: string]: any
  }
  options?: {
    [name: string]: any
  }
}
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
    fs.appendFileSync(`logs/Manager-${dayjs().format('YYYY-MM-DD')}.txt`, toJSON(data) + (newLine ? '\n' : ''));
    if (newLine) console.log(data);
    else process.stdout.write(data);
  }
  static consoleLog(text: any, newLine = true): void {
    fs.appendFileSync(`logs/Manager-${dayjs().format('YYYY-MM-DD')}.txt`, toJSON(text) + (newLine ? '\n' : ''));
    if (newLine) console.log(text);
    else process.stdout.write(text);
  }
}

const time = (): string => chalk.gray(`[${dayjs().format('YYYY-MM-DD HH:mm:ss')}] `);
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
export { Logger, time, http, push };
