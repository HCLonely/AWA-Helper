/**
 * @file TimeOnSiteTask
 * @description Sends cancellable AWA time-on-site tracking heartbeats.
 */
/* global __ */
import chalk from 'chalk';
import { Logger, sleep, time } from '../../../tools';
import type { AWAClient } from '../../../client/AWA/AWAClient';

class TimeOnSiteTask {
  static async do(awa: AWAClient, signal?: AbortSignal): Promise<boolean> {
    while (!signal?.aborted) {
      if (awa.trackTimes % 3 === 0) {
        if (!awa.questInfo.timeOnSite) {
          new Logger(time() + chalk.yellow(__('noTimeOnSiteInfo')));
          return false;
        }
        if (parseInt(awa.questInfo.timeOnSite.addedArp, 10) >= parseInt(awa.questInfo.timeOnSite.maxArp, 10)) {
          new Logger(time() + chalk.green(__('timeOnSiteCompleted')));
          return true;
        }
      }
      if (awa.trackError >= 6) {
        new Logger(`${time()}${chalk.red(__('trackError', chalk.yellow('AWA')))}`);
        return false;
      }
      const logger = new Logger(`${time()}${__('sendingOnlineTrack', chalk.yellow('AWA'))}`, false);
      await awa.sendTrack(undefined, logger);
      if (!await sleep(60, signal)) return true;
    }
    return true;
  }
}

export { TimeOnSiteTask };
