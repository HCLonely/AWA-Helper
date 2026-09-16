/**
 * @file src/core/Manager/Job.ts
 * @description 定义 Manager 可调度作业的名称、运行函数和资源释放契约。
 */
import type { TaskOutcome } from '../TaskOutcome';
export type JobName = 'dailyQuest' | 'achievement' | 'artifact';
export type JobStatus = 'idle' | 'running' | 'stopping' | 'completed' | 'partial' | 'skipped' | 'failed' | 'cancelled';

export interface JobResult {
  success: boolean
  message?: string
  startedAt: string
  finishedAt: string
}

export interface Job {
  readonly name: JobName
    /**
     * 执行任务。
     * @param signal - 用于取消当前异步操作的中止信号，类型为 `AbortSignal`。
     * @param payload - 当前请求或操作使用的数据内容，类型为 `unknown`。
     * @returns `Promise<boolean>`，明确表示作业是否成功完成。
     */
run(signal: AbortSignal, payload?: unknown): Promise<boolean | TaskOutcome>
    /**
     * 释放资源。
     * @returns `void | Promise<void>`，清理同步完成时返回空值，异步清理时返回完成凭据。
     */
dispose?(): Promise<void> | void
}

export interface JobSnapshot {
  runId?: string
  source?: import('./RunHistory').RunSource
  name: JobName
  status: JobStatus
  startedAt?: string
  finishedAt?: string
  message?: string
}
