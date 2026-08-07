/*
 * @Author       : HCLonely
 * @Date         : 2025-08-22 19:21:49
 * @LastEditTime : 2025-08-22 19:43:45
 * @LastEditors  : HCLonely
 * @FilePath     : /AWA-Helper/src/TimeOnSite.ts
 * @Description  : 在线时长
 */
/* global __ */
import chalk from 'chalk';
import { Logger, sleep, time } from './tool';

class TimeOnSite {
  static async do(signal?: AbortSignal): Promise<boolean> {
    while (!signal?.aborted) {
      if (globalThis.quest.trackTimes % 3 === 0) {
        if (!globalThis.quest.questInfo.timeOnSite) {
          new Logger(time() + chalk.yellow(__('noTimeOnSiteInfo')));
          return false;
        }
        if (parseInt(globalThis.quest.questInfo.timeOnSite.addedArp, 10) >= parseInt(globalThis.quest.questInfo.timeOnSite.maxArp, 10)) {
          new Logger(time() + chalk.green(__('timeOnSiteCompleted')));
          return true;
        }
      }
      if (globalThis.quest.trackError >= 6) {
        new Logger(`${time()}${chalk.red(__('trackError', chalk.yellow('AWA')))}`);
        return false;
      }
      const logger = new Logger(`${time()}${__('sendingOnlineTrack', chalk.yellow('AWA'))}`, false);
      await globalThis.quest.sendTrack(undefined, logger);
      if (!await sleep(60, signal)) return true;
    }
    return true;
  }
}

export { TimeOnSite };
