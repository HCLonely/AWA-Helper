/**
 * @file src/core/Manager/jobs/DailyQuestJob.ts
 * @description 将每日任务运行器适配为 Manager 的一次性或计划作业。
 */
import type { TaskOutcome } from '../../TaskOutcome';
import { withRunConfiguration } from '../../../tools/config/RunConfiguration';
import { runDailyQuestOutcome } from '../../DailyQuest/DailyQuestRunner';
import type { Job } from '../Job';

class DailyQuestJob implements Job {
  readonly name = 'dailyQuest' as const;
  constructor(private readonly configPath?: string) {}
  /**
   * 执行任务。
   * @param signal - 用于取消当前异步操作的中止信号，类型为 `AbortSignal`。
   * @returns `Promise<TaskOutcome>`，明确表示每日任务是否成功完成。
   */
  run(signal: AbortSignal): Promise<TaskOutcome> {
    if (signal.aborted) {
      return Promise.resolve({
        status: 'cancelled'
      });
    }
    return withRunConfiguration(this.configPath, () => runDailyQuestOutcome(signal));
  }
}

export { DailyQuestJob };
