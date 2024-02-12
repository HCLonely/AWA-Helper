/* eslint-disable max-len */
import * as chalk from 'chalk';
import * as dayjs from 'dayjs';
import * as fs from 'fs';
import { format } from 'util';

const toJSON = (e: any): string => {
  if (typeof e === 'string') {
    // eslint-disable-next-line no-control-regex
    return e.replace(/\x1B\[[\d]*?m/g, '');
  }

  return format(e);
};

class Logger {
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

export { Logger, time };
