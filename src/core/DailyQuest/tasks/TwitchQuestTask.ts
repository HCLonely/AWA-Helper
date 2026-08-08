/**
 * Coordinates AWA task state, Twitch channel discovery and AWA heartbeats.
 * Neither platform client knows about the other one.
 */
import chalk from 'chalk';
import { AWAApiClient } from '../../../client/AWA/AWAApiClient';
import type { AWAClient } from '../../../client/AWA/AWAClient';
import { TwitchClient } from '../../../client/Twitch/TwitchClient';
import { Logger, sleep, time } from '../../../tools';

export class TwitchQuestTask {
  constructor(
    private readonly questState: AWAClient,
    private readonly awa: AWAApiClient,
    private readonly twitch: TwitchClient
  ) {}

  private isComplete(): boolean {
    const progress = this.questState.questInfo.watchTwitch;
    return progress?.[0] === '15' && parseFloat(progress?.[1] || '0') >= this.questState.additionalTwitchARP;
  }

  async run(signal?: AbortSignal): Promise<boolean> {
    let retriedAuthorization = false;
    while (!signal?.aborted && !this.isComplete()) {
      const streams = await this.awa.getAvailableStreams();
      const trackingInfo = await this.twitch.findTrackingChannel([...streams.Hive, ...streams.Nexus]);
      if (!trackingInfo) {
        new Logger(`${time()}${__('noLive')}`);
        if (!await sleep(5 * 60, signal)) return true;
        continue;
      }
      try {
        const result = await this.awa.sendTwitchTrack(trackingInfo);
        if (result.state === 'daily_cap_reached') return true;
        if (result.state === 'streamer_offline' || result.state === 'no_channel_found') {
          if (!await sleep(60, signal)) return true;
          continue;
        }
        if (!result.success) return false;
        retriedAuthorization = false;
      } catch (error: any) {
        if (error?.response?.status === 403 && !retriedAuthorization) {
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
