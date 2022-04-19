import * as chalk from 'chalk';
import * as dayjs from 'dayjs';
import * as fs from 'fs';

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

export { log, sleep, random, time };
