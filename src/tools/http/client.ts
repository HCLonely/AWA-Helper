/** Configured Axios client with bounded retries for idempotent requests. */
import axios from 'axios';
import chalk from 'chalk';
import { Logger } from '../logging';
import { time } from '../common';

export const http = axios.create({ maxRedirects: 5, timeout: 5 * 60 * 1000 });

http.interceptors.response.use((response) => response, async (error) => {
  const { config, response } = error;
  if (!config) return Promise.reject(error);
  const method = (config.method || 'get').toUpperCase();
  const status = response?.status as number | undefined;
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method) || (status && ![408, 429, 502, 503, 504].includes(status))) {
    return Promise.reject(error);
  }
  config.retryCount = config.retryCount || 0;
  if (config.retryCount >= (config.retryTimes || 3)) return Promise.reject(error);
  config.retryCount++;
  if (config.Logger) {
    config.Logger.log(chalk.red('Error'));
    config.Logger = new Logger(`${time()}${chalk.yellow(__('retrying', chalk.blue(config.retryCount)))}`, false);
  }
  const retryAfter = Number.parseInt(response?.headers?.['retry-after'] || '', 10);
  const exponential = Math.min((config.retryDelay || 1000) * (2 ** (config.retryCount - 1)), 30 * 1000);
  const delay = Number.isFinite(retryAfter) ? retryAfter * 1000 : exponential + Math.floor(Math.random() * 250);
  await new Promise((resolve) => setTimeout(resolve, delay));
  return http(config);
});
