/**
 * @file src/client/AWA/APIs/twitch/sendTwitchTrack.ts
 * @description 向 AWA 发送一次 Twitch 扩展观看心跳。
 */
import { AWAContext } from '../../AWAContext';
import type { TwitchTrackResult, TwitchTrackState } from '../../types';
export type { TwitchTrackResult, TwitchTrackState } from '../../types';

/**
 * 发送 send Twitch Track 相关数据。
 * @param context - 发起远程请求及保存会话状态所需的客户端上下文，类型为 `AWAContext`。
 * @param options - 创建实例或执行操作所需的配置选项，类型为 `{ channelId: string; jwt: string; extensionID?: string; }`。
 * @returns `Promise<TwitchTrackResult>`，sendTwitchTrack 请求返回的响应结果。
 */
export const sendTwitchTrack = async (
  context: AWAContext,
  { channelId, jwt, extensionID }: { channelId: string; jwt: string; extensionID?: string }
): Promise<TwitchTrackResult> => {
  const options: myAxiosConfig = {
    url: `${context.baseURL}/twitch/extensions/track`, method: 'GET', retryTimes: 0,
    headers: {
      origin: `https://${extensionID}.ext-twitch.tv`, referer: `https://${extensionID}.ext-twitch.tv/`,
      'user-agent': context.headers['user-agent'], 'x-extension-channel': channelId, 'x-extension-jwt': jwt
    }
  };
  if (context.httpsAgent) {
    options.httpsAgent = context.httpsAgent;
  }
  const response = await context.request<{ state?: string; success?: boolean; message?: string }>(options);
  const known = ['daily_cap_reached', 'streamer_online', 'streamer_offline', 'no_channel_found'];
  const rawState = response.data.state;
  const state = typeof rawState === 'string' && known.includes(rawState) ? rawState as TwitchTrackState : 'unknown';
  return { success: response.data?.success === true, state, message: response.data?.message };
};
