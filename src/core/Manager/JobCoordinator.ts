/**
 * @file JobCoordinator
 * @description Starts, cancels, waits for, and deduplicates Manager-controlled jobs.
 */
import type { Job, JobName, JobResult } from './Job';
import { JobStateStore } from './JobStateStore';

interface ActiveJob {
  controller: AbortController
  completion: Promise<JobResult>
}

class JobCoordinator {
  readonly states = new JobStateStore();
  private readonly jobs = new Map<JobName, Job>();
  private readonly active = new Map<JobName, ActiveJob>();

  register(job: Job): void {
    if (this.jobs.has(job.name)) throw new Error(`Job already registered: ${job.name}`);
    this.jobs.set(job.name, job);
    this.states.register(job.name);
  }

  start(name: JobName, payload?: unknown): Promise<JobResult> {
    const running = this.active.get(name);
    if (running) return running.completion;
    const job = this.jobs.get(name);
    if (!job) throw new Error(`Unknown job: ${name}`);
    const controller = new AbortController();
    const startedAt = new Date().toISOString();
    this.states.update(name, 'running', { startedAt, finishedAt: undefined, message: undefined });
    const completion = job.run(controller.signal, payload)
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

  async stop(name: JobName): Promise<void> {
    const running = this.active.get(name);
    if (!running) return;
    this.states.update(name, 'stopping');
    running.controller.abort(new Error('Stopped by Manager'));
    await running.completion;
  }

  async stopAll(): Promise<void> {
    await Promise.all([...this.active.keys()].map((name) => this.stop(name)));
    await Promise.all([...this.jobs.values()].map(async (job) => job.dispose?.()));
  }
}

export { JobCoordinator };
