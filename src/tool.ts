import * as chalk from 'chalk';
import * as dayjs from 'dayjs';

const log = (text: string, newLine = true): void => {
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
