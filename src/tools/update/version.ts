/** Semantic release comparison and GitHub release availability check. */
import chalk from 'chalk';
import { Cookie, http, netError } from '../http';
import { formatProxy } from '../proxy';
import { Logger } from '../logging';
import { time } from '../common';
import { push } from '../notification';

export const isNewVersion = (currentVersion: string, latestVersion: string): boolean => {
  const current = currentVersion.replace(/^V/i, '').split('.').map((value) => parseInt(value, 10));
  const latest = latestVersion.replace(/^V/i, '').split('.').map((value) => parseInt(value, 10));
  for (let index = 0; index < Math.max(current.length, latest.length); index++) {
    if ((latest[index] || 0) !== (current[index] || 0)) return (latest[index] || 0) > (current[index] || 0);
  }
  return false;
};

export const checkUpdate = async (
  version: string,
  _managerServer: managerServer | undefined,
  autoUpdate: boolean,
  changelog: string,
  proxy?: proxy
): Promise<void> => {
  const logger = new Logger(`${time()}${__('checkingUpdating')}`, false);
  const options: myAxiosConfig = { validateStatus: (status) => status === 302, maxRedirects: 0, Logger: logger };
  if (proxy?.enable?.includes('github') && proxy.host && proxy.port) options.httpsAgent = formatProxy(proxy);
  try {
    const response = await http.head('https://github.com/HCLonely/AWA-Helper/releases/latest', options);
    globalThis.secrets = [...new Set([...globalThis.secrets, ...Object.values(Cookie.ToJson(response.headers?.['set-cookie']))])];
    const latest = response.headers.location?.match(/tag\/v?([\d.]+)/)?.[1];
    if (!latest) return logger.log(chalk.red(__('logStatusFailed')));
    if (isNewVersion(version, latest)) {
      logger.log(chalk.green(__('newVersion', chalk.yellow(`V${latest}`))));
      if (autoUpdate && !process.argv.includes('--no-update')) {
        new Logger(time() + chalk.yellow(__('automaticInstallDisabled')));
      }
      new Logger(`${time()}${__('downloadLink', chalk.yellow(response.headers.location))}`);
      globalThis.newVersionNotice = `\n\n${__('newVersion', `V${latest}`)}\n${__('downloadLink', response.headers.location)}`;
      return;
    }
    if (process.argv.includes('--no-update')) {
      await push(`${__('pushTitle')}:\n\n${__('autoUpdated', version)}\n\n${__('updateLog')}\n${changelog}`);
    }
    logger.log(chalk.green(__('noUpdate')));
  } catch (error) {
    const requestError = error as Parameters<typeof netError>[0];
    logger.log(chalk.red(__('logStatusError')) + netError(requestError));
    globalThis.secrets = [...new Set([...globalThis.secrets, ...Object.values(Cookie.ToJson(requestError.response?.headers?.['set-cookie']))])];
    new Logger(error);
  }
};
