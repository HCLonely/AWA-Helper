import { runWithRequestSignal } from '../../../tools/http/RequestContext';
/**
 * @file src/core/Manager/jobs/AchievementJob.ts
 * @description 将成就服务封装为可由 Manager 创建、运行和释放的作业。
 */
import { AchievementService } from '../../Achievement/AchievementService';
import { loadConfig } from '../../../tools/config';
import { createCookieCommit } from '../../../tools/config/YamlConfig';
import type { Job } from '../Job';

class AchievementJob implements Job {
  readonly name = 'achievement' as const;
  private service?: AchievementService;

  /**
   * 初始化 Achievement Job 实例。
   * @param configPath - 配置文件路径；每次运行时重新读取，避免使用 Manager 启动时缓存的 Cookie。
   */
  constructor(private readonly configPath: string) {}

  /**
   * 执行 run 相关数据。
   * @param signal - 用于取消当前异步操作的中止信号，类型为 `AbortSignal`。
   * @returns `Promise<boolean>`，表示 run 检查是否通过。
   */
  run(signal: AbortSignal): Promise<boolean> {
    return runWithRequestSignal(signal ?? new AbortController().signal, () => this.runTask(signal));
  }

  private async runTask(signal: AbortSignal): Promise<boolean> {
    if (signal.aborted) {
      return false;
    }
    const appConfig = loadConfig(this.configPath).raw;
    if (!appConfig.awaCookie) {
      throw new Error('awaCookie is not configured');
    }
    const commitCookie = createCookieCommit(this.configPath, appConfig.awaCookie);
    this.service = new AchievementService({
      awaCookie: appConfig.awaCookie,
      awaHost: appConfig.awaHost,
      twitchCookie: appConfig.twitchCookie,
      proxy: appConfig.proxy,
      userAgent: appConfig.UA,
      logRequests: appConfig.debug?.http === true
    });
    /**
     * 处理 abort 相关逻辑。
     * @returns `void`，该函数仅执行副作用，不返回值。
     */
    const abort = (): void => this.service?.stop();
    signal.addEventListener('abort', abort, { once: true });
    let initialized = false;
    try {
      await this.service.init();
      initialized = true;
      if (signal.aborted) {
        return false;
      }
      await this.service.run(signal);
      return true;
    } finally {
      signal.removeEventListener('abort', abort);
      try {
        if (initialized && this.service) {
          commitCookie(this.service.awa.newCookie);
        }
      } finally {
        this.service?.destroy();
        this.service = undefined;
      }
    }
  }

  /**
   * 停止 dispose 相关数据。
   * @returns `void`，该函数仅执行副作用，不返回值。
   */
  dispose(): void {
    this.service?.destroy();
    this.service = undefined;
  }
}

export { AchievementJob };
