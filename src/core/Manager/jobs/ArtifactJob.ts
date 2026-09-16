import { trackRunStep } from '../RunHistory';
import { withRunConfiguration, createSessionCommit as createCookieCommit } from '../../../tools/config/RunConfiguration';
import { runWithRequestSignal } from '../../../tools/http/RequestContext';
/**
 * @file src/core/Manager/jobs/ArtifactJob.ts
 * @description 将指定遗物槽位的替换请求封装为 Manager 作业。
 */
import { ArtifactService } from '../../Artifact/ArtifactService';
import type { Job } from '../Job';

class ArtifactJob implements Job {
  readonly name = 'artifact' as const;

  /**
   * 初始化 Artifact Job 实例。
   * @param configPath - 待读取或写入文件的路径，类型为 `string`。
   */
  constructor(private readonly configPath: string) {}

  /**
   * 执行 run 相关数据。
   * @param signal - 用于取消当前异步操作的中止信号，类型为 `AbortSignal`。
   * @param payload - 当前请求或操作使用的数据内容，类型为 `unknown`。
   * @returns `Promise<boolean>`，表示 run 检查是否通过。
   */
  run(signal: AbortSignal, payload?: unknown): Promise<boolean> {
    return runWithRequestSignal(signal ?? new AbortController().signal, () => this.runTask(signal, payload));
  }

  private async runTask(signal: AbortSignal, payload?: unknown): Promise<boolean> {
    if (signal.aborted) {
      return false;
    }
    const ids = Array.isArray(payload) ? payload.filter((id): id is number => Number.isSafeInteger(id) && id > 0) : [];
    if (ids.length !== 3 || new Set(ids).size !== 3 || ids.length !== (Array.isArray(payload) ? payload.length : 0)) {
      throw new Error('Exactly three distinct positive artifact IDs are required');
    }
    return withRunConfiguration(this.configPath, () => this.runConfiguredTask(signal, ids));
  }

  private async runConfiguredTask(signal: AbortSignal, ids: number[]): Promise<boolean> {
    const service = new ArtifactService(this.configPath);
    if (!service.initted) {
      return false;
    }
    const commitCookie = createCookieCommit(this.configPath, service.initialCookie);
    if (!await trackRunStep('Artifact initialization', () => service.init(signal))) {
      return false;
    }
    try {
      if (signal.aborted) {
        return false;
      }
      return await trackRunStep('Reconcile equipped artifacts', () => service.start(ids, signal));
    } finally {
      commitCookie(service.newCookie);
    }
  }
}

export { ArtifactJob };
