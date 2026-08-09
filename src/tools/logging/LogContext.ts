/** Async log scope propagation and deterministic per-scope log filenames. */
import { AsyncLocalStorage } from 'async_hooks';
import dayjs from 'dayjs';
import * as path from 'path';

export type LogScope = 'manager' | 'dailyQuest' | 'achievement' | 'artifact';

const storage = new AsyncLocalStorage<LogScope>();
const prefixes: Record<LogScope, string> = {
  manager: 'Manager',
  dailyQuest: 'DailyQuest',
  achievement: 'Achievement',
  artifact: 'Artifact'
};

export const getLogScope = (): LogScope => storage.getStore() || 'manager';

export const runWithLogScope = <T>(scope: LogScope, callback: () => T): T => storage.run(scope, callback);

export const getLogFilePath = (scope: LogScope, date = dayjs().format('YYYY-MM-DD')): string => path.join('logs', `${prefixes[scope]}-${date}.txt`);

export const isLogScope = (value: unknown): value is LogScope => typeof value === 'string' && Object.hasOwn(prefixes, value);
