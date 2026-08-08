/**
 * @file Job
 * @description Defines the lifecycle contract used by every Manager-controlled job.
 */
export type JobName = 'dailyQuest' | 'achievement' | 'artifact';
export type JobStatus = 'idle' | 'running' | 'stopping' | 'completed' | 'failed' | 'cancelled';

export interface JobResult {
  success: boolean
  message?: string
  startedAt: string
  finishedAt: string
}

export interface Job {
  readonly name: JobName
  run(signal: AbortSignal, payload?: unknown): Promise<boolean | void>
  dispose?(): Promise<void> | void
}

export interface JobSnapshot {
  name: JobName
  status: JobStatus
  startedAt?: string
  finishedAt?: string
  message?: string
}
