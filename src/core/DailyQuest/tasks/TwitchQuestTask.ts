import { runWithRequestSignal } from '../../../tools/http/RequestContext';
/**
 * @file src/core/DailyQuest/tasks/TwitchQuestTask.ts
 * @description 发现可用 Twitch 频道并向 AWA 周期提交直播观看跟踪心跳。
 */
import chalk from 'chalk';
import axios from 'axios';
import { AWAError } from '../../../client/AWA/AWAError';
import { AWAApiClient } from '../../../client/AWA/AWAApiClient';
import { TwitchClient } from '../../../client/Twitch/TwitchClient';
import type { DailyQuestRuntime } from '../DailyQuestRuntime';
import { Logger, sleep, time } from '../../../tools';

export class TwitchQuestTask {
  /**
   * 初始化 Twitch Quest Task 实例。
   * @param runtime - 当前任务使用的运行时实例，类型为 `DailyQuestRuntime`。
   * @param awa - 用于调用 Alienware Arena 接口的客户端，类型为 `AWAApiClient`。
   * @param twitch - 用于调用 Twitch 接口的客户端，类型为 `TwitchClient`。
   * @param retryDelaySeconds - 控制等待时长的数值，类型为 `number`。
   */
  constructor(
    private readonly runtime: DailyQuestRuntime,
    private readonly awa: AWAApiClient,
    private readonly twitch: TwitchClient,
    private readonly retryDelaySeconds = 5 * 60,
    private readonly controlCenterPollSeconds = 60
  ) {}

  /**
   * 检查 is Complete 相关数据。
   * @returns `boolean`，表示 isComplete 检查是否通过。
   */
  private isComplete(): boolean {
    const progress = this.runtime.state.questInfo.watchTwitch;
    const earnedArp = parseFloat(progress?.[0] || '0') + parseFloat(progress?.[1] || '0');
    return earnedArp >= 15 + this.runtime.state.additionalTwitchARP;
  }

  /**
   * 执行 run 相关数据。
   * @param signal - 用于取消当前异步操作的中止信号，类型为 `AbortSignal | undefined`。
   * @returns `Promise<boolean>`，表示 run 检查是否通过。
   */
  run(signal?: AbortSignal): Promise<boolean> {
    return runWithRequestSignal(signal ?? new AbortController().signal, () => this.runTask(signal));
  }

  private async runTask(signal?: AbortSignal): Promise<boolean> {
    let retriedAuthorization = false;
    let dailyCapReached = false;
    let heartbeatErrors = 0;
    while (!signal?.aborted && !this.isComplete()) {
      if (dailyCapReached) {
        if (!await sleep(this.controlCenterPollSeconds, signal)) {
          return true;
        }
        continue;
      }
      const streamLogger = new Logger(`${time()}${__('gettingLiveInfo')}`, false);
      const streams = await this.awa.twitch.getAvailableStreams().catch((error: unknown) => {
        streamLogger.log(chalk.red(__('logStatusError')));
        new Logger(error);
        return null;
      });
      if (!streams) {
        if (!await this.waitForAvailableStreams(signal)) {
          return true;
        }
        continue;
      }
      const streamCount = streams.Hive.length + streams.Nexus.length;
      streamLogger.log(streamCount > 0 ? chalk.green(`OK (${streamCount})`) : chalk.blue(__('noLive')));
      if (streamCount === 0) {
        if (!await this.waitForAvailableStreams(signal)) {
          return true;
        }
        continue;
      }
      const channelLogger = new Logger(`${time()}${__('gettingChannelInfo')}`, false);
      const trackingLookup = await this.twitch.channels.findTracking([...streams.Hive, ...streams.Nexus]);
      if (!trackingLookup.found) {
        channelLogger.log(chalk.blue(__('noLive')));
        if (!await this.waitForAvailableStreams(signal)) {
          return true;
        }
        continue;
      }
      const trackingInfo = trackingLookup.value;
      channelLogger.log(chalk.green(`${__('logStatusOk')} (${trackingInfo.streamerName || trackingInfo.channelId})`));
      const logger = new Logger(`${time()}${__('sendingOnlineTrack', chalk.yellow('Twitch'))}`, false);
      try {
        const result = await this.awa.twitch.sendTrack(trackingInfo);
        heartbeatErrors = 0;
        logger.log(result.success ? chalk.green(`${__('logStatusOk')} (${result.state})`) : chalk.red(`${__('logStatusError')} (${result.state})`));
        if (result.state === 'daily_cap_reached') {
          new Logger(`${time()}${chalk.green(result.message || __('obtainedArp'))}`);
          dailyCapReached = true;
          continue;
        }
        if (result.state === 'streamer_offline' || result.state === 'no_channel_found') {
          new Logger(`${time()}${chalk.blue(result.state === 'streamer_offline' ? __('liveOffline', chalk.yellow(trackingInfo.channelId)) : __('noChannelFound', chalk.yellow(trackingInfo.channelId)))}`);
          if (!await sleep(60, signal)) {
            return true;
          }
          continue;
        }
        if (!result.success) {
          return false;
        }
        retriedAuthorization = false;
      } catch (error) {
        if (signal?.aborted || axios.isCancel(error)) {
          return true;
        }
        logger.log(chalk.red(__('logStatusError')));
        let status: number | undefined;
        if (error instanceof AWAError) {
          status = error.statusCode;
        } else if (error && typeof error === 'object' && 'response' in error) {
          status = (error as { response?: { status?: number } }).response?.status;
        }
        const retryable = error instanceof AWAError ? error.retryable : axios.isAxiosError(error) && status === undefined;
        if (status !== 403 && (retryable || status === 408 || status === 429 || (status !== undefined && status >= 500))) {
          new Logger(`${time()}${chalk.red(error instanceof Error ? error.message : String(error))}`);
          heartbeatErrors++;
          if (heartbeatErrors >= 6) {
            new Logger(`${time()}${chalk.yellow(__('trackError', chalk.yellow('Twitch')))}`);
            if (!await sleep(5 * 60, signal)) {
              return true;
            }
            heartbeatErrors = 0;
            continue;
          }
        } else if (status === 403 && !retriedAuthorization) {
          new Logger(`${time()}${chalk.yellow(__('twitchAuthorizationExpiredRetrying'))}`);
          retriedAuthorization = true;
          if (!await this.initializeTwitch()) {
            return false;
          }
        } else {
          new Logger(`${time()}${chalk.red(error instanceof Error ? error.message : String(error))}`);
          return false;
        }
      }
      if (!await sleep(60, signal)) {
        return true;
      }
    }
    return true;
  }

  /**
   * 等待 wait For Available Streams 相关数据。
   * @param signal - 用于取消当前异步操作的中止信号，类型为 `AbortSignal | undefined`。
   * @returns `Promise<boolean>`，表示 waitForAvailableStreams 检查是否通过。
   */
  private async waitForAvailableStreams(signal?: AbortSignal): Promise<boolean> {
    new Logger(`${time()}${chalk.blue(__('getLiveInfoAlert', String(this.retryDelaySeconds / 60)))}`);
    return sleep(this.retryDelaySeconds, signal);
  }

  private async initializeTwitch(): Promise<boolean> {
    const sessionLogger = new Logger(`${time()}${__('initing', chalk.yellow('TwitchTrack'))}`, false);
    try {
      await this.twitch.session.verify();
      sessionLogger.log(chalk.green(__('logStatusOk')));
      const authorizationLogger = new Logger(`${time()}${__('checkAuthorization', chalk.yellow('Twitch'))}`, false);
      const linked = await this.twitch.extensions.checkLinked();
      authorizationLogger.log(linked.ok ? chalk.green(__('authorized')) : chalk.red(__('notAuthorized')));
      return linked.ok;
    } catch (error) {
      sessionLogger.log(chalk.red(__('logStatusError')));
      new Logger(error);
      return false;
    }
  }
}
