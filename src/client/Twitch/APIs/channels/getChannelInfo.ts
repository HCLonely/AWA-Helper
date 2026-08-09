/**
 * @file src/client/Twitch/APIs/channels/getChannelInfo.ts
 * @description 将 Twitch 登录名解析为对应的频道标识。
 */
import { TwitchContext } from '../../TwitchContext';
import { TwitchError } from '../../TwitchError';
import { channelInfoQuery } from '../../queries';
import { parseTwitchChannelId, type TwitchChannelQueryData } from '../../parsers';
import type { TwitchGqlEnvelope } from '../../types';

/**
 * 获取 get Channel Info 相关数据。
 * @param context - 发起远程请求及保存会话状态所需的客户端上下文，类型为 `TwitchContext`。
 * @param channelLogin - 用于定位目标对象的名称，类型为 `string`。
 * @returns `Promise<string | null>`，getChannelInfo 获取到的数据。
 */
export const getChannelInfo = async (context: TwitchContext, channelLogin: string): Promise<string | null> => {
  if (!context.clientId) throw new TwitchError('getChannelInfo', 'Twitch Client-Id is not initialized');
  const options: myAxiosConfig = {
    url: 'https://gql.twitch.tv/gql', method: 'POST',
    headers: { ...context.headers, 'Client-Id': context.clientId }, data: channelInfoQuery(channelLogin)
  };
  if (context.httpsAgent) options.httpsAgent = context.httpsAgent;
  try {
    const response = await context.request<Array<TwitchGqlEnvelope<TwitchChannelQueryData>>>(options);
    return parseTwitchChannelId(response.data);
  } catch (error) {
    throw new TwitchError('getChannelInfo', `Unable to resolve Twitch channel ${channelLogin}`, true, undefined, { cause: error });
  }
};
