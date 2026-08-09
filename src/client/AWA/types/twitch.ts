/** AWA-owned Twitch heartbeat response models. */
export type TwitchTrackState = 'daily_cap_reached' | 'streamer_online' | 'streamer_offline' | 'no_channel_found' | 'unknown';
export interface TwitchTrackResult { success: boolean; state: TwitchTrackState; message?: string }
