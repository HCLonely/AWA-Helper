/*
 * @Author       : HCLonely
 * @Date         : 2025-08-22 19:21:49
 * @LastEditTime : 2025-08-22 19:43:45
 * @LastEditors  : HCLonely
 * @FilePath     : /AWA-Helper/src/TimeOnSite.ts
 * @Description  : 在线时长
 */
/* global __ */
import * as chalk from 'chalk';
import { Logger, sleep, time } from './tool';

class TimeOnSite {
  static async do(): Promise<any> {
    if (globalThis.quest.trackTimes % 3 === 0) {
      if (!globalThis.quest.questInfo.timeOnSite) {
        return new Logger(time() + chalk.yellow(__('noTimeOnSiteInfo')));
      }
      if (parseInt(globalThis.quest.questInfo.timeOnSite.addedArp, 10) >= parseInt(globalThis.quest.questInfo.timeOnSite.maxArp, 10)) {
        return new Logger(time() + chalk.green(__('timeOnSiteCompleted')));
      }
    }
    if (globalThis.quest.trackError >= 6) {
      return new Logger(`${time()}${chalk.red(__('trackError', chalk.yellow('AWA')))}`);
    }
    const logger = new Logger(`${time()}${__('sendingOnlineTrack', chalk.yellow('AWA'))}`, false);
    await globalThis.quest.sendTrack(undefined, logger);
    await sleep(60);
    return this.do();
  }
}

export { TimeOnSite };
