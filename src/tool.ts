/* global proxy */
import * as chalk from 'chalk';
import * as dayjs from 'dayjs';
import * as fs from 'fs';
import axios, { AxiosRequestConfig } from 'axios';
import * as tunnel from 'tunnel';

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

const checkUpdate = async (version: string, proxy?: proxy):Promise<void> => {
  log(`${time()}正在检测更新...`, false);
  const options: AxiosRequestConfig = {
    validateStatus: (status: number) => status === 302,
    maxRedirects: 0
  };
  if (proxy?.host && proxy.port) {
    options.httpsAgent = tunnel.httpsOverHttp({
      proxy: {
        host: proxy.host,
        port: proxy.port
      }
    });
  }
  return await axios.head('https://github.com/HCLonely/AWA-Helper/releases/latest', options)
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
      log(chalk.red('Error'));
      console.error(error);
      return;
    });
};

export { log, sleep, random, time, checkUpdate };
