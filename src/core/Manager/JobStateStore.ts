/**
 * @file src/core/Manager/JobStateStore.ts
 * @description 保存可序列化的作业快照，供调度器、API 和 WebUI 查询。
 */
import type { JobName, JobSnapshot, JobStatus } from './Job';

class JobStateStore {
  private readonly states = new Map<JobName, JobSnapshot>();
  private readonly listeners = new Set<(states: JobSnapshot[]) => void>();

  /**
   * 注册作业。
   * @param name - 用于定位目标对象的名称，类型为 `JobName`。
   * @returns `void`，该函数仅执行副作用，不返回值。
   */
  register(name: JobName): void {
    if (!this.states.has(name)) {
      this.states.set(name, {
        name,
        status: 'idle'
      });
      this.notify();
    }
  }

  /**
   * 更新状态。
   * @param name - 用于定位目标对象的名称，类型为 `JobName`。
   * @param status - 当前对象或任务的状态，类型为 `JobStatus`。
   * @param fields - 需要读取、校验或更新的字段，类型为 `Partial<JobSnapshot>`。
   * @returns `JobSnapshot`，update 操作完成后的结果。
   */
  update(name: JobName, status: JobStatus, fields: Partial<JobSnapshot> = {}): JobSnapshot {
    const next = {
      ...(this.states.get(name) || {
        name
      }),
      ...fields,
      name,
      status
    };
    this.states.set(name, next);
    this.notify();
    return next;
  }

  subscribe(listener: (states: JobSnapshot[]) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * 获取数据。
   * @param name - 用于定位目标对象的名称，类型为 `JobName`。
   * @returns `JobSnapshot | undefined`，get 获取到的数据。
   */
  get(name: JobName): JobSnapshot | undefined {
    const state = this.states.get(name);
    return state ? {
      ...state
    } : undefined;
  }

  /**
   * 列出作业状态。
   * @returns `JobSnapshot[]`，list 收集或筛选得到的数据列表。
   */
  list(): JobSnapshot[] {
    return [...this.states.values()].map((state) => ({
      ...state
    }));
  }

  private notify(): void {
    const snapshot = this.list();
    this.listeners.forEach((listener) => listener(snapshot));
  }
}

export { JobStateStore };
