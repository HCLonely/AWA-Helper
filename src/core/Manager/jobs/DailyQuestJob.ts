/**
 * @file DailyQuestJob
 * @description Adapts DailyQuestRunner to the Manager Job contract.
 */
import { runDailyQuest } from '../../DailyQuest/DailyQuestRunner';
import type { Job } from '../Job';

class DailyQuestJob implements Job {
  readonly name = 'dailyQuest' as const;
  run(signal: AbortSignal): Promise<boolean | void> {
    return runDailyQuest({ signal });
  }
}

export { DailyQuestJob };
