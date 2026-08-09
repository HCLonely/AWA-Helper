/**
 * @file src/client/AWA/types/twitch.ts
 * @description 定义 AWA Twitch 心跳请求与奖励响应数据。
 */
export type TwitchTrackState = 'daily_cap_reached' | 'streamer_online' | 'streamer_offline' | 'no_channel_found' | 'unknown';
export interface TwitchTrackResult { success: boolean; state: TwitchTrackState; message?: string }
