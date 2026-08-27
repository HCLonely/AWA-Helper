/**
 * @file src/core/Manager/JobCoordinator.ts
 * @description 注册并协调作业的启动、去重、取消、等待和状态同步。
 */
import type { Job, JobName, JobResult } from './Job';
import { JobStateStore } from './JobStateStore';
import { Logger, time } from '../../tools';
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
    if (this.jobs.has(job.name)) {
      throw new Error(`Job already registered: ${job.name}`);
    }
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
    if (running) {
      new Logger(`${time()}${__('jobDuplicateStart', name)}`);
      return running.completion;
    }
    const job = this.jobs.get(name);
    if (!job) {
      throw new Error(`Unknown job: ${name}`);
    }
    const controller = new AbortController();
    const startedAt = new Date().toISOString();
    new Logger(`${time()}${__('jobDispatching', name)}`);
    this.states.update(name, 'running', { startedAt, finishedAt: undefined, message: undefined });
    const completion = runWithLogScope(name, async () => {
      new Logger(`${time()}${__('jobStarted', name)}`);
      return job.run(controller.signal, payload);
    })
      .then((success) => {
        const result: JobResult = {
          success: success === true && !controller.signal.aborted,
          message: controller.signal.aborted ? __('jobCancelledMessage') : undefined,
          startedAt,
          finishedAt: new Date().toISOString()
        };
        let status: 'cancelled' | 'completed' | 'failed' = result.success ? 'completed' : 'failed';
        if (controller.signal.aborted) {
          status = 'cancelled';
        }
        this.states.update(name, status, result);
        const localizedStatus = __(`jobStatus_${status}`);
        runWithLogScope(name, () => new Logger(`${time()}${__('jobFinished', name, localizedStatus)}`));
        new Logger(`${time()}${__('managerJobFinished', name, localizedStatus)}`);
        return result;
      })
      .catch((error: unknown) => {
        const result: JobResult = {
          success: false,
          message: error instanceof Error ? error.message : String(error),
          startedAt,
          finishedAt: new Date().toISOString()
        };
        const status = controller.signal.aborted ? 'cancelled' : 'failed';
        this.states.update(name, status, result);
        const localizedStatus = __(`jobStatus_${status}`);
        runWithLogScope(name, () => new Logger(`${time()}${__('jobFinishedWithMessage', name, localizedStatus, result.message || '')}`));
        new Logger(`${time()}${__('managerJobFinishedWithMessage', name, localizedStatus, result.message || '')}`);
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
    if (!running) {
      new Logger(`${time()}${__('jobStopIgnored', name)}`);
      return;
    }
    new Logger(`${time()}${__('jobStopRequested', name)}`);
    runWithLogScope(name, () => new Logger(`${time()}${__('jobCancellationRequested')}`));
    this.states.update(name, 'stopping');
    running.controller.abort(new Error(__('jobStoppedByManager')));
    await running.completion;
  }

  /**
   * 停止 stop All 相关数据。
   * @returns `Promise<void>`，异步操作完成后兑现，不携带结果值。
   */
  async stopAll(): Promise<void> {
    new Logger(`${time()}${__('jobStoppingAll', String(this.active.size))}`);
    await Promise.all([...this.active.keys()].map((name) => this.stop(name)));
    await Promise.all([...this.jobs.values()].map(async (job) => job.dispose?.()));
    new Logger(`${time()}${__('jobAllDisposed')}`);
  }
}

export { JobCoordinator };
