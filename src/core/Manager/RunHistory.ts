import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { AsyncLocalStorage } from 'async_hooks';
import { atomicWriteFileSync } from '../../tools/config/YamlConfig';
import { safeErrorMessage } from '../../tools/logging/sanitize';
import type { JobName, JobStatus } from './Job';

export type RunSource = 'manual' | 'schedule' | 'once';
export interface RunStep { name: string; status: string; startedAt: string; finishedAt?: string; message?: string }
export interface RunRecord {
  id: string; name: JobName; source: RunSource; status: JobStatus | 'interrupted';
  startedAt: string; finishedAt?: string; message?: string; steps: RunStep[];
}

const context = new AsyncLocalStorage<{ history: RunHistory; id: string; signal?: AbortSignal }>();
export const withRunHistory = <T>(history: RunHistory, id: string, action: () => Promise<T>, signal?: AbortSignal): Promise<T> => context.run({ history, id, signal }, action);

/** Records subtask results without coupling platform clients to Manager. */
export const trackRunStep = async <T>(name: string, action: () => Promise<T>): Promise<T> => {
  const scope = context.getStore();
  const step: RunStep = { name, status: 'running', startedAt: new Date().toISOString() };
  scope?.history.step(scope.id, step);
  try {
    const result = await action();
    const outcome = result && typeof result === 'object' ? result as { status?: string; ok?: boolean; message?: string; error?: unknown; reason?: string } : undefined;
    step.status = outcome?.status || (result === false || outcome?.ok === false ? 'failed' : 'completed');
    const message = outcome?.message || outcome?.error || (outcome?.ok === false ? outcome.reason : undefined);
    step.message = message ? safeErrorMessage(message).slice(0, 1000) : undefined;
    return result;
  } catch (error) {
    step.status = 'failed';
    step.message = safeErrorMessage(error).slice(0, 1000);
    throw error;
  } finally {
    if (scope?.signal?.aborted) {
      step.status = 'cancelled';
    }
    step.finishedAt = new Date().toISOString();
    scope?.history.step(scope.id, step);
  }
};

/** Bounded atomic snapshots. Only explicitly enabled runtime stores touch disk. */
export class RunHistory {
  private records: RunRecord[] = [];
  private file?: string;
  private limit = 200;
  storageError?: string;

  open(file: string, limit = 200): void {
    this.file = file;
    this.limit = limit;
    fs.mkdirSync(path.dirname(file), { recursive: true });
    if (fs.existsSync(file)) {
      try {
        if (fs.statSync(file).size > 16 * 1024 * 1024) {
          throw new Error('Run history exceeds 16 MiB');
        }
        const data = JSON.parse(fs.readFileSync(file, 'utf8'));
        if (data.version !== 1 || !Array.isArray(data.runs) || data.runs.some((run: RunRecord) => !run || !['dailyQuest', 'achievement', 'artifact'].includes(run.name) || typeof run.id !== 'string' ||
          !Number.isFinite(Date.parse(run.startedAt)) || !['manual', 'schedule', 'once'].includes(run.source) ||
          !['idle', 'running', 'stopping', 'completed', 'partial', 'skipped', 'failed', 'cancelled', 'interrupted'].includes(run.status) ||
          !Array.isArray(run.steps) || run.steps.length > 100 || run.steps.some((step) => !step || typeof step.name !== 'string' || typeof step.status !== 'string' || !Number.isFinite(Date.parse(step.startedAt))))) {
          throw new Error('Invalid run history format');
        }
        this.records = data.runs.slice(-limit);
      } catch (error) {
        // Preserve corrupt evidence instead of overwriting it with an empty history.
        this.storageError = safeErrorMessage(error);
        fs.renameSync(file, `${file}.corrupt-${Date.now()}`);
      }
    }
    const now = new Date().toISOString();
    this.records.forEach((run) => {
      if (run.status === 'running' || run.status === 'stopping') {
        run.status = 'interrupted';
        run.finishedAt = now;
        run.message = 'Manager stopped before this run finished';
        run.steps.forEach((step) => {
          if (step.status === 'running') {
            step.status = 'interrupted'; step.finishedAt = now;
          }
        });
      }
    });
    this.save();
  }

  begin(name: JobName, source: RunSource): string {
    const id = randomUUID();
    this.records.push({ id, name, source, status: 'running', startedAt: new Date().toISOString(), steps: [] });
    this.prune();
    this.save();
    return id;
  }

  finish(id: string, status: JobStatus, message?: string): void {
    const run = this.records.find((item) => item.id === id);
    if (!run) {
      return;
    }
    Object.assign(run, { status, finishedAt: new Date().toISOString(), message: message ? safeErrorMessage(message).slice(0, 1000) : undefined });
    this.prune();
    this.save();
  }

  step(id: string, step: RunStep): void {
    const run = this.records.find((item) => item.id === id);
    if (!run) {
      return;
    }
    const existing = run.steps.findIndex((item) => item.name === step.name && item.startedAt === step.startedAt);
    if (existing >= 0) {
      run.steps[existing] = { ...step };
    } else if (run.steps.length < 100) {
      run.steps.push({ ...step });
    }
    this.save();
  }

  list(limit = this.limit): RunRecord[] {
    return structuredClone(this.records.slice(-limit).reverse());
  }

  failures(name: JobName): number {
    let count = 0;
    for (const run of this.list().filter((item) => item.name === name && !['running', 'stopping', 'skipped'].includes(item.status))) {
      if (!['failed', 'partial', 'interrupted'].includes(run.status)) {
        break;
      }
      count++;
    }
    return count;
  }

  private prune(): void {
    while (this.records.length > this.limit) {
      const index = this.records.findIndex((run) => !['running', 'stopping'].includes(run.status));
      if (index < 0) {
        break;
      }
      this.records.splice(index, 1);
    }
  }

  private save(): void {
    if (!this.file) {
      return;
    }
    try {
      let content = JSON.stringify({ version: 1, runs: this.records });
      while (Buffer.byteLength(content) > 8 * 1024 * 1024) {
        const index = this.records.findIndex((run) => !['running', 'stopping'].includes(run.status));
        if (index < 0) {
          break;
        }
        this.records.splice(index, 1);
        content = JSON.stringify({ version: 1, runs: this.records });
      }
      atomicWriteFileSync(this.file, content);
    } catch (error) {
      this.storageError = safeErrorMessage(error);
    }
  }
}
