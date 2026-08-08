/**
 * Coordinates AWA task state, Twitch channel discovery and AWA heartbeats.
 * Neither platform client knows about the other one.
 */
import chalk from 'chalk';
import { AWAApiClient } from '../../../client/AWA/AWAApiClient';
import { TwitchClient } from '../../../client/Twitch/TwitchClient';
import type { DailyQuestRuntime } from '../DailyQuestRuntime';
import { Logger, sleep, time } from '../../../tools';

export class TwitchQuestTask {
  constructor(
    private readonly runtime: DailyQuestRuntime,
    private readonly awa: AWAApiClient,
    private readonly twitch: TwitchClient
  ) {}

  private isComplete(): boolean {
    const progress = this.runtime.state.questInfo.watchTwitch;
    return progress?.[0] === '15' && parseFloat(progress?.[1] || '0') >= this.runtime.state.additionalTwitchARP;
  }

  async run(signal?: AbortSignal): Promise<boolean> {
    let retriedAuthorization = false;
    while (!signal?.aborted && !this.isComplete()) {
      const streamLogger = new Logger(`${time()}${__('gettingLiveInfo')}`, false);
      const streams = await this.awa.getAvailableStreams().catch((error) => {
        streamLogger.log(chalk.red('Error'));
        new Logger(error);
        return null;
      });
      if (!streams) {
        if (!await sleep(5 * 60, signal)) return true;
        continue;
      }
      const streamCount = streams.Hive.length + streams.Nexus.length;
      streamLogger.log(streamCount > 0 ? chalk.green(`OK (${streamCount})`) : chalk.blue(__('noLive')));
      const channelLogger = new Logger(`${time()}${__('gettingChannelInfo', chalk.yellow('Twitch'))}`, false);
      const trackingInfo = await this.twitch.findTrackingChannel([...streams.Hive, ...streams.Nexus]);
      if (!trackingInfo) {
        channelLogger.log(chalk.red('Error'));
        if (!await sleep(5 * 60, signal)) return true;
        continue;
      }
      channelLogger.log(chalk.green(`OK (${trackingInfo.streamerName || trackingInfo.channelId})`));
      const logger = new Logger(`${time()}${__('sendingOnlineTrack', chalk.yellow('Twitch'))}`, false);
      try {
        const result = await this.awa.sendTwitchTrack(trackingInfo);
        logger.log(result.success ? chalk.green(`OK (${result.state})`) : chalk.red(`Error (${result.state})`));
        if (result.state === 'daily_cap_reached') {
          new Logger(`${time()}${chalk.green(result.message || __('obtainedArp'))}`);
          return true;
        }
        if (result.state === 'streamer_offline' || result.state === 'no_channel_found') {
          new Logger(`${time()}${chalk.blue(result.state === 'streamer_offline' ? __('liveOffline', chalk.yellow(trackingInfo.channelId)) : __('noChannelFound', chalk.yellow(trackingInfo.channelId)))}`);
          if (!await sleep(60, signal)) return true;
          continue;
        }
        if (!result.success) return false;
        retriedAuthorization = false;
      } catch (error: any) {
        logger.log(chalk.red('Error'));
        if (error?.response?.status === 403 && !retriedAuthorization) {
          new Logger(`${time()}${chalk.yellow('Twitch authorization expired, retrying')}`);
          retriedAuthorization = true;
          if (!await this.twitch.init()) return false;
        } else {
          new Logger(`${time()}${chalk.red(error instanceof Error ? error.message : String(error))}`);
          return false;
        }
      }
      if (!await sleep(60, signal)) return true;
    }
    return true;
  }
}
