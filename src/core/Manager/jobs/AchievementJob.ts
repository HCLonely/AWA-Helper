/**
 * @file src/core/Manager/jobs/AchievementJob.ts
 * @description 将成就服务封装为可由 Manager 创建、运行和释放的作业。
 */
import { AchievementService } from '../../Achievement/AchievementService';
import type { Job } from '../Job';

class AchievementJob implements Job {
  readonly name = 'achievement' as const;
  private service?: AchievementService;

  /**
   * 初始化 Achievement Job 实例。
   * @param appConfig - 控制当前操作行为的配置，类型为 `config`。
   */
  constructor(private readonly appConfig: config) {}

  /**
   * 执行 run 相关数据。
   * @param signal - 用于取消当前异步操作的中止信号，类型为 `AbortSignal`。
   * @returns `Promise<boolean>`，表示 run 检查是否通过。
   */
  async run(signal: AbortSignal): Promise<boolean> {
    if (!this.appConfig.awaCookie) {
      throw new Error('awaCookie is not configured');
    }
    this.service = new AchievementService({
      awaCookie: this.appConfig.awaCookie,
      awaHost: this.appConfig.awaHost,
      twitchCookie: this.appConfig.twitchCookie,
      proxy: this.appConfig.proxy,
      userAgent: this.appConfig.UA,
      logRequests: this.appConfig.debug?.http === true
    });
    /**
     * 处理 abort 相关逻辑。
     * @returns `void`，该函数仅执行副作用，不返回值。
     */
    const abort = (): void => this.service?.stop();
    signal.addEventListener('abort', abort, { once: true });
    try {
      await this.service.init();
      if (signal.aborted) {
        return false;
      }
      await this.service.run(signal);
      return true;
    } finally {
      signal.removeEventListener('abort', abort);
      this.service?.destroy();
      this.service = undefined;
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
