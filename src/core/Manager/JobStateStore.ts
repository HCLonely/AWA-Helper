/**
 * @file JobStateStore
 * @description Stores serializable job state for the scheduler, API, and WebUI.
 */
import type { JobName, JobSnapshot, JobStatus } from './Job';

class JobStateStore {
  private readonly states = new Map<JobName, JobSnapshot>();

  register(name: JobName): void {
    if (!this.states.has(name)) this.states.set(name, { name, status: 'idle' });
  }

  update(name: JobName, status: JobStatus, fields: Partial<JobSnapshot> = {}): JobSnapshot {
    const next = { ...(this.states.get(name) || { name }), ...fields, name, status };
    this.states.set(name, next);
    return next;
  }

  get(name: JobName): JobSnapshot | undefined {
    const state = this.states.get(name);
    return state ? { ...state } : undefined;
  }

  list(): JobSnapshot[] {
    return [...this.states.values()].map((state) => ({ ...state }));
  }
}

export { JobStateStore };
