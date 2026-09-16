import { RunHistory, withRunHistory, type RunSource } from './RunHistory';
import { successfulOutcome, type TaskOutcome } from '../TaskOutcome';
import { safeErrorMessage } from '../../tools/logging/sanitize';
/**
 * @file src/core/Manager/JobCoordinator.ts
 * @description 注册并协调作业的启动、去重、取消、等待和状态同步。
 */
import type { Job, JobName, JobResult } from './Job';
import { JobStateStore } from './JobStateStore';
import { Logger, time } from '../../tools';
import { runWithLogScope } from '../../tools/logging';
import { runWithRequestSignal } from '../../tools/http/RequestContext';

interface ActiveJob {
  controller: AbortController
  completion: Promise<JobResult>
}

class JobCoordinator {
  readonly states = new JobStateStore();
  readonly history = new RunHistory();
  private readonly jobs = new Map<JobName, Job>();
  private readonly active = new Map<JobName, ActiveJob>();
  private closing = false;
  private stopPromise?: Promise<void>;

  get isClosing(): boolean {
    return this.closing;
  }

  beginShutdown(): void {
    this.closing = true;
  }

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
  start(name: JobName, payload?: unknown, source: RunSource = 'manual'): Promise<JobResult> {
    if (this.closing) {
      throw new Error('Manager is shutting down');
    }
    const running = this.active.get(name);
    if (running) {
      new Logger(`${time()}${__('jobDuplicateStart', name)}`);
      return running.completion;
    }
    const job = this.jobs.get(name);
    if (!job) {
      throw new Error(`Unknown job: ${name}`);
    }
    const runId = this.history.begin(name, source);
    const controller = new AbortController();
    const startedAt = new Date().toISOString();
    const completion = Promise.resolve().then(() => runWithLogScope(name, async () => {
      if (controller.signal.aborted) {
        return false;
      }
      new Logger(`${time()}${__('jobStarted', name)}`);
      return withRunHistory(this.history, runId, () => runWithRequestSignal(controller.signal, () => job.run(controller.signal, payload)), controller.signal);
    }))
      .then((success) => {
        const outcome: TaskOutcome = typeof success === 'boolean' ? { status: success ? 'completed' : 'failed' } : success;
        const result: JobResult = {
          success: successfulOutcome(outcome) && !controller.signal.aborted,
          message: controller.signal.aborted ? __('jobCancelledMessage') : outcome.message,
          startedAt,
          finishedAt: new Date().toISOString()
        };
        let { status } = outcome;
        if (controller.signal.aborted) {
          status = 'cancelled';
        }
        this.history.finish(runId, status, result.message);
        this.states.update(name, status, result);
        const localizedStatus = __(`jobStatus_${status}`);
        runWithLogScope(name, () => new Logger(`${time()}${__('jobFinished', name, localizedStatus)}`));
        new Logger(`${time()}${__('managerJobFinished', name, localizedStatus)}`);
        return result;
      })
      .catch((error: unknown) => {
        const result: JobResult = {
          success: false,
          message: safeErrorMessage(error),
          startedAt,
          finishedAt: new Date().toISOString()
        };
        const status = controller.signal.aborted ? 'cancelled' : 'failed';
        this.history.finish(runId, status, result.message);
        this.states.update(name, status, result);
        const localizedStatus = __(`jobStatus_${status}`);
        runWithLogScope(name, () => new Logger(`${time()}${__('jobFinishedWithMessage', name, localizedStatus, result.message || '')}`));
        new Logger(`${time()}${__('managerJobFinishedWithMessage', name, localizedStatus, result.message || '')}`);
        return result;
      })
      .finally(() => this.active.delete(name));
    this.active.set(name, { controller, completion });
    new Logger(`${time()}${__('jobDispatching', name)}`);
    this.states.update(name, 'running', { runId, source, startedAt, finishedAt: undefined, message: undefined });
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
  stopAll(): Promise<void> {
    this.beginShutdown();
    this.stopPromise ??= Promise.resolve().then(async () => {
      new Logger(`${time()}${__('jobStoppingAll', String(this.active.size))}`);
      await Promise.all([...this.active.keys()].map((name) => this.stop(name)));
      const disposed = await Promise.allSettled([...this.jobs.values()].map(async (job) => job.dispose?.()));
      const failures = disposed.filter((result): result is PromiseRejectedResult => result.status === 'rejected');
      if (failures.length) {
        throw new AggregateError(failures.map((result) => result.reason), 'Job cleanup failed');
      }
      new Logger(`${time()}${__('jobAllDisposed')}`);
    });
    return this.stopPromise;
  }
}

export { JobCoordinator };
