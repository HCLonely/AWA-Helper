/** Configured Axios client with bounded retries for idempotent requests. */
import axios from 'axios';
import chalk from 'chalk';
import { Logger } from '../logging';
import { time } from '../common';
import { sleep } from '../common/async';
import { withRequestSignal } from './RequestContext';

export const http = axios.create({ maxRedirects: 5, timeout: 5 * 60 * 1000 });

http.interceptors.request.use((config) => withRequestSignal(config));

export const retryDelayMs = (retryAfter: unknown, fallback: number, now = Date.now()): number => {
  const value = String(retryAfter ?? '').trim();
  const seconds = value && /^\d+(\.\d+)?$/.test(value) ? Number(value) : NaN;
  const parsed = Number.isFinite(seconds) ? seconds * 1000 : Date.parse(value) - now;
  return Math.max(0, Number.isFinite(parsed) ? parsed : fallback);
};

http.interceptors.response.use((response) => response, async (error) => {
  const { config, response } = error;
  if (!config || axios.isCancel(error) || config.signal?.aborted) {
    return Promise.reject(error);
  }
  const method = (config.method || 'get').toUpperCase();
  const status = response?.status as number | undefined;
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method) || (status && ![408, 429, 502, 503, 504].includes(status))) {
    return Promise.reject(error);
  }
  config.retryCount = config.retryCount || 0;
  const retryTimes = Number.isFinite(config.retryTimes) ? Math.min(10, Math.max(0, config.retryTimes)) : 3;
  if (config.retryCount >= retryTimes) {
    return Promise.reject(error);
  }
  config.retryCount++;
  if (config.Logger) {
    config.Logger.log(chalk.red(__('logStatusError')));
    config.Logger = new Logger(`${time()}${chalk.yellow(__('retrying', chalk.blue(config.retryCount)))}`, false);
  }
  const exponential = Math.min((config.retryDelay ?? 1000) * (2 ** (config.retryCount - 1)), 30 * 1000);
  const delay = retryDelayMs(response?.headers?.['retry-after'], exponential + Math.floor(Math.random() * 250));
  // A long server-directed wait belongs to the job scheduler, never retry early.
  if (delay > 30000) {
    return Promise.reject(error);
  }
  if (!await sleep(delay / 1000, config.signal)) {
    throw new axios.CanceledError('Request cancelled');
  }
  return http(config);
});
