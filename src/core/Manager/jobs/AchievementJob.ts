/**
 * @file AchievementJob
 * @description Owns AchievementService creation and cleanup for Manager scheduling.
 */
import { AchievementService } from '../../Achievement/AchievementService';
import type { Job } from '../Job';

class AchievementJob implements Job {
  readonly name = 'achievement' as const;
  private service?: AchievementService;

  constructor(private readonly appConfig: config) {}

  async run(signal: AbortSignal): Promise<boolean> {
    if (!this.appConfig.awaCookie) throw new Error('awaCookie is not configured');
    this.service = new AchievementService({
      awaCookie: this.appConfig.awaCookie,
      awaHost: this.appConfig.awaHost,
      twitchCookie: this.appConfig.twitchCookie,
      proxy: this.appConfig.proxy,
      userAgent: this.appConfig.UA
    });
    const abort = (): void => this.service?.stop();
    signal.addEventListener('abort', abort, { once: true });
    try {
      await this.service.init();
      if (signal.aborted) return false;
      await this.service.run(signal);
      return true;
    } finally {
      signal.removeEventListener('abort', abort);
      this.service?.destroy();
      this.service = undefined;
    }
  }

  dispose(): void {
    this.service?.destroy();
    this.service = undefined;
  }
}

export { AchievementJob };
