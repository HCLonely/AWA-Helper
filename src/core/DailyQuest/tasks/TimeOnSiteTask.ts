/**
 * @file TimeOnSiteTask
 * @description Sends cancellable AWA time-on-site tracking heartbeats.
 */
/* global __ */
import chalk from 'chalk';
import { Logger, sleep, time } from '../../../tools';
import type { DailyQuestRuntime } from '../DailyQuestRuntime';

class TimeOnSiteTask {
  static async do(runtime: DailyQuestRuntime, signal?: AbortSignal): Promise<boolean> {
    while (!signal?.aborted) {
      if (runtime.state.trackTimes % 3 === 0) {
        if (!runtime.state.questInfo.timeOnSite) {
          new Logger(time() + chalk.yellow(__('noTimeOnSiteInfo')));
          return false;
        }
        if (parseInt(runtime.state.questInfo.timeOnSite.addedArp, 10) >= parseInt(runtime.state.questInfo.timeOnSite.maxArp, 10)) {
          new Logger(time() + chalk.green(__('timeOnSiteCompleted')));
          return true;
        }
      }
      if (runtime.state.trackError >= 6) {
        new Logger(`${time()}${chalk.red(__('trackError', chalk.yellow('AWA')))}`);
        return false;
      }
      await runtime.sendTimeOnSite();
      if (!await sleep(60, signal)) return true;
    }
    return true;
  }
}

export { TimeOnSiteTask };
