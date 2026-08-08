/** Sends one Twitch extension heartbeat to AWA; retry policy belongs to Core. */
import { http } from '../tools-path';
import { AWAContext } from '../../AWAContext';

export type TwitchTrackState = 'daily_cap_reached' | 'streamer_online' | 'streamer_offline' | 'no_channel_found' | 'unknown';
export interface TwitchTrackResult { success: boolean; state: TwitchTrackState; message?: string }

export const sendTwitchTrack = async (
  context: AWAContext,
  { channelId, jwt, extensionID }: { channelId: string; jwt: string; extensionID?: string }
): Promise<TwitchTrackResult> => {
  const options: myAxiosConfig = {
    url: `${context.baseURL}/twitch/extensions/track`, method: 'GET',
    headers: {
      origin: `https://${extensionID}.ext-twitch.tv`, referer: `https://${extensionID}.ext-twitch.tv/`,
      'user-agent': context.headers['user-agent'], 'x-extension-channel': channelId, 'x-extension-jwt': jwt
    }
  };
  if (context.httpsAgent) options.httpsAgent = context.httpsAgent;
  const response = await http(options);
  const known = ['daily_cap_reached', 'streamer_online', 'streamer_offline', 'no_channel_found'];
  const state = known.includes(response.data?.state) ? response.data.state as TwitchTrackState : 'unknown';
  return { success: response.data?.success === true, state, message: response.data?.message };
};
