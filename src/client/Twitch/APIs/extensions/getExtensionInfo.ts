/**
 * @file src/client/Twitch/APIs/extensions/getExtensionInfo.ts
 * @description 读取指定 Twitch 频道的 Arena Rewards Tracker 扩展令牌。
 */
import { TwitchContext } from '../../TwitchContext';
import { TwitchError } from '../../TwitchError';
import { extensionInfoQuery } from '../../queries';
import { parseArenaExtensionInfo, type ChannelExtensionsData } from '../../parsers';
import type { TwitchExtensionInfo, TwitchGqlEnvelope } from '../../types';
import type { LookupResult } from '../../../shared';
export type { TwitchExtensionInfo } from '../../types';

/**
 * 获取 get Extension Info 相关数据。
 * @param context - 发起远程请求及保存会话状态所需的客户端上下文，类型为 `TwitchContext`。
 * @param channelId - 目标资源的唯一标识，类型为 `string`。
 * @returns 找到 Arena Rewards Tracker 时返回扩展信息，否则返回 `not-found`。
 */
export const getExtensionInfo = async (context: TwitchContext, channelId: string): Promise<LookupResult<TwitchExtensionInfo>> => {
  if (!context.clientId) throw new TwitchError('getExtensionInfo', 'Twitch Client-Id is not initialized');
  const options: myAxiosConfig = {
    url: 'https://gql.twitch.tv/gql', method: 'POST',
    headers: { ...context.headers, 'Client-Id': context.clientId }, data: extensionInfoQuery(channelId)
  };
  if (context.httpsAgent) options.httpsAgent = context.httpsAgent;
  try {
    const response = await context.request<Array<TwitchGqlEnvelope<ChannelExtensionsData>>>(options);
    const extension = parseArenaExtensionInfo(response.data);
    return extension ? { found: true, value: extension } : { found: false, reason: 'not-found' };
  } catch (error) {
    throw new TwitchError('getExtensionInfo', `Unable to query extensions for channel ${channelId}`, true, undefined, { cause: error });
  }
};
