/** Data needed to submit an AWA Twitch heartbeat for one channel. */
export interface TwitchChannelTrackingInfo {
  channelId: string;
  jwt: string;
  extensionID?: string;
  streamerName?: string;
}
