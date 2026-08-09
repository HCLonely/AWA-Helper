/** Sends one Twitch extension heartbeat to AWA; retry policy belongs to Core. */
import { AWAContext } from '../../AWAContext';
import type { TwitchTrackResult, TwitchTrackState } from '../../types';
export type { TwitchTrackResult, TwitchTrackState } from '../../types';

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
  const response = await context.request<{ state?: string; success?: boolean; message?: string }>(options);
  const known = ['daily_cap_reached', 'streamer_online', 'streamer_offline', 'no_channel_found'];
  const rawState = response.data.state;
  const state = typeof rawState === 'string' && known.includes(rawState) ? rawState as TwitchTrackState : 'unknown';
  return { success: response.data?.success === true, state, message: response.data?.message };
};
