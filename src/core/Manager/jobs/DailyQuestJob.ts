/**
 * @file src/core/Manager/jobs/DailyQuestJob.ts
 * @description 将每日任务运行器适配为 Manager 的一次性或计划作业。
 */
import { runDailyQuest } from '../../DailyQuest/DailyQuestRunner';
import type { Job } from '../Job';

class DailyQuestJob implements Job {
  readonly name = 'dailyQuest' as const;
  /**
   * 执行 run 相关数据。
   * @param signal - 用于取消当前异步操作的中止信号，类型为 `AbortSignal`。
   * @returns `Promise<boolean | void>`，run 执行完成后的结果。
   */
  run(signal: AbortSignal): Promise<boolean | void> {
    return runDailyQuest({ signal });
  }
}

export { DailyQuestJob };
