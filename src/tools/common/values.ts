/** Small stateless value helpers used throughout Core. */
import chalk from 'chalk';
import dayjs from 'dayjs';

export const random = (min: number, max: number): number => Math.floor((Math.random() * (max - min + 1)) + min);
export const time = (): string => chalk.gray(`[${dayjs().format('YYYY-MM-DD HH:mm:ss')}] `);
