/**
 * @file src/client/Twitch/types/channel.ts
 * @description 定义提交 AWA Twitch 心跳所需的频道跟踪信息。
 */
export interface TwitchChannelTrackingInfo {
  channelId: string;
  jwt: string;
  extensionID?: string;
  streamerName?: string;
}
