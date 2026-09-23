/**
 * @file src/core/DailyQuest/tasks/TimeOnSiteTask.ts
 * @description 按任务状态周期发送可取消的 AWA 在线时长心跳。
 */
/* global __ */
import chalk from 'chalk';
import { Logger, sleep, time } from '../../../tools';
import type { DailyQuestRuntime } from '../DailyQuestRuntime';

class TimeOnSiteTask {
  /**
   * 执行任务操作。
   * @param runtime - 当前任务使用的运行时实例，类型为 `DailyQuestRuntime`。
   * @param signal - 用于取消当前异步操作的中止信号，类型为 `AbortSignal | undefined`。
   * @returns `Promise<boolean>`，表示 do 检查是否通过。
   */
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
      await runtime.sendTimeOnSite();
      if (runtime.state.trackError >= 6) {
        new Logger(`${time()}${chalk.red(__('trackError', chalk.yellow('AWA')))}`);
        if (!await sleep(5 * 60, signal)) {
          return true;
        }
        runtime.state.trackError = 0;
        continue;
      }
      if (!await sleep(60, signal)) {
        return true;
      }
    }
    return true;
  }
}

export { TimeOnSiteTask };
