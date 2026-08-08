/** ASF-only facade. AWA Steam quest requests and polling are coordinated in Core. */
import { ASFContext } from './ASFContext';
import { addLicense, getOwnedGames, playGames, resumeBot, verifyConnection } from './APIs';
import chalk from 'chalk';
import { Logger, time } from '../../tools';

export class SteamClient {
  readonly context: ASFContext;
  status: 'none' | 'running' | 'stopped' = 'none';

  constructor({ asfProtocol, asfHost, asfPort, asfPassword = '', asfBotname, proxy }: {
    asfProtocol: string; asfHost: string; asfPort: number; asfPassword?: string; asfBotname: string; proxy?: proxy
  }) {
    this.context = new ASFContext({
      protocol: asfProtocol, host: asfHost, port: asfPort, password: asfPassword, botName: asfBotname, proxy
    });
  }

  async init(): Promise<boolean> {
    const logger = new Logger(`${time()}${__('initing', chalk.yellow('ASF'))}`, false);
    try {
      const connected = await verifyConnection(this.context);
      logger.log(connected ? chalk.green('OK') : chalk.red('Error'));
      return connected;
    } catch (error) {
      logger.log(chalk.red('Error'));
      new Logger(error);
      return false;
    }
  }
  getOwnedGames(appIds: string[]): Promise<string[]> { return getOwnedGames(this.context, appIds); }
  addLicense(appIds: string[]): Promise<boolean> { return addLicense(this.context, appIds); }
  async playGames(appIds: string[]): Promise<boolean> {
    const started = await playGames(this.context, appIds);
    if (started) this.status = 'running';
    return started;
  }
  async resume(): Promise<boolean> {
    if (this.status === 'stopped') return true;
    const logger = new Logger(`${time()}${__('stoppingPlayingGames')}`, false);
    try {
      const resumed = await resumeBot(this.context);
      if (resumed) this.status = 'stopped';
      logger.log(resumed ? chalk.green('OK') : chalk.red('Error'));
      return resumed;
    } catch (error) {
      logger.log(chalk.red('Error'));
      new Logger(error);
      return false;
    }
  }
}
