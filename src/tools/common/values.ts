/**
 * @file src/tools/common/values.ts
 * @description 提供核心模块共用的无状态值处理辅助函数。
 */
import chalk from 'chalk';
import dayjs from 'dayjs';

export const random = (min: number, max: number): number => Math.floor((Math.random() * (max - min + 1)) + min);
export const time = (): string => chalk.gray(`[${dayjs().format('YYYY-MM-DD HH:mm:ss')}] `);
