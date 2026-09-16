/**
 * @file src/core/TaskOutcome.ts
 * @description 定义任务执行结果，并判断任务是否成功。
 */
export type OutcomeStatus = 'completed' | 'partial' | 'skipped' | 'failed' | 'cancelled';
export interface TaskOutcome {
  status: OutcomeStatus;
  message?: string
}
export const successfulOutcome = (outcome: TaskOutcome): boolean => outcome.status === 'completed' || outcome.status === 'skipped';
