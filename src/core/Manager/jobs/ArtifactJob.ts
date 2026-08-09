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
  async run(signal: AbortSignal, payload?: unknown): Promise<boolean> {
    if (signal.aborted) {
      return false;
    }
    const ids = Array.isArray(payload) ? payload.filter((id): id is number => Number.isInteger(id)) : [];
    if (ids.length === 0) {
      throw new Error('Artifact IDs are required');
    }
    const service = new ArtifactService(this.configPath);
    if (!service.initted) {
      return false;
    }
    if (!await service.init() || signal.aborted) {
      return false;
    }
    return service.start(ids);
  }
}

export { ArtifactJob };
