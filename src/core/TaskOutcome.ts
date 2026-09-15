export type OutcomeStatus = 'completed' | 'partial' | 'skipped' | 'failed' | 'cancelled';
export interface TaskOutcome { status: OutcomeStatus; message?: string }
export const successfulOutcome = (outcome: TaskOutcome): boolean => outcome.status === 'completed' || outcome.status === 'skipped';
