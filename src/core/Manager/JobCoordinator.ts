/**
 * @file src/core/Manager/JobCoordinator.ts
 * @description 注册并协调作业的启动、去重、取消、等待和状态同步。
 */
import type { Job, JobName, JobResult } from './Job';
import { JobStateStore } from './JobStateStore';
import { runWithLogScope } from '../../tools/logging';

interface ActiveJob {
  controller: AbortController
  completion: Promise<JobResult>
}

class JobCoordinator {
  readonly states = new JobStateStore();
  private readonly jobs = new Map<JobName, Job>();
  private readonly active = new Map<JobName, ActiveJob>();

  /**
   * 添加 register 相关数据。
   * @param job - 需要注册、调度或查询的作业，类型为 `Job`。
   * @returns `void`，该函数仅执行副作用，不返回值。
   */
  register(job: Job): void {
    if (this.jobs.has(job.name)) throw new Error(`Job already registered: ${job.name}`);
    this.jobs.set(job.name, job);
    this.states.register(job.name);
  }

  /**
   * 执行 start 相关数据。
   * @param name - 用于定位目标对象的名称，类型为 `JobName`。
   * @param payload - 当前请求或操作使用的数据内容，类型为 `unknown`。
   * @returns `Promise<JobResult>`，start 执行完成后的结果。
   */
  start(name: JobName, payload?: unknown): Promise<JobResult> {
    const running = this.active.get(name);
    if (running) return running.completion;
    const job = this.jobs.get(name);
    if (!job) throw new Error(`Unknown job: ${name}`);
    const controller = new AbortController();
    const startedAt = new Date().toISOString();
    this.states.update(name, 'running', { startedAt, finishedAt: undefined, message: undefined });
    const completion = runWithLogScope(name, () => job.run(controller.signal, payload))
      .then((success) => {
        const result: JobResult = {
          success: success !== false && !controller.signal.aborted,
          message: controller.signal.aborted ? 'Job cancelled' : undefined,
          startedAt,
          finishedAt: new Date().toISOString()
        };
        let status: 'cancelled' | 'completed' | 'failed' = result.success ? 'completed' : 'failed';
        if (controller.signal.aborted) status = 'cancelled';
        this.states.update(name, status, result);
        return result;
      })
      .catch((error: unknown) => {
        const result: JobResult = {
          success: false,
          message: error instanceof Error ? error.message : String(error),
          startedAt,
          finishedAt: new Date().toISOString()
        };
        this.states.update(name, controller.signal.aborted ? 'cancelled' : 'failed', result);
        return result;
      })
      .finally(() => this.active.delete(name));
    this.active.set(name, { controller, completion });
    return completion;
  }

  /**
   * 停止 stop 相关数据。
   * @param name - 用于定位目标对象的名称，类型为 `JobName`。
   * @returns `Promise<void>`，异步操作完成后兑现，不携带结果值。
   */
  async stop(name: JobName): Promise<void> {
    const running = this.active.get(name);
    if (!running) return;
    this.states.update(name, 'stopping');
    running.controller.abort(new Error('Stopped by Manager'));
    await running.completion;
  }

  /**
   * 停止 stop All 相关数据。
   * @returns `Promise<void>`，异步操作完成后兑现，不携带结果值。
   */
  async stopAll(): Promise<void> {
    await Promise.all([...this.active.keys()].map((name) => this.stop(name)));
    await Promise.all([...this.jobs.values()].map(async (job) => job.dispose?.()));
  }
}

export { JobCoordinator };
