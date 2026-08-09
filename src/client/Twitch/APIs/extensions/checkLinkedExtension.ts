/**
 * @file src/client/Twitch/APIs/extensions/checkLinkedExtension.ts
 * @description 检查当前 Twitch 账户是否已关联 Arena Rewards Tracker 扩展。
 */
import { TwitchContext } from '../../TwitchContext';
import { TwitchError } from '../../TwitchError';
import { linkedExtensionsQuery } from '../../queries';
import { parseLinkedArenaExtension, type LinkedExtensionsData } from '../../parsers';
import type { TwitchGqlEnvelope } from '../../types';

/**
 * 检查 check Linked Extension 相关数据。
 * @param context - 发起远程请求及保存会话状态所需的客户端上下文，类型为 `TwitchContext`。
 * @returns `Promise<boolean>`，表示 checkLinkedExtension 检查是否通过。
 */
export const checkLinkedExtension = async (context: TwitchContext): Promise<boolean> => {
  if (!context.clientId) throw new TwitchError('checkLinkedExtension', 'Twitch Client-Id is not initialized');
  const options: myAxiosConfig = {
    url: 'https://gql.twitch.tv/gql', method: 'POST',
    headers: { ...context.headers, 'Client-Id': context.clientId }, data: linkedExtensionsQuery
  };
  if (context.httpsAgent) options.httpsAgent = context.httpsAgent;
  try {
    const response = await context.request<Array<TwitchGqlEnvelope<LinkedExtensionsData>>>(options);
    return parseLinkedArenaExtension(response.data);
  } catch (error) {
    throw new TwitchError('checkLinkedExtension', 'Unable to query linked Twitch extensions', true, undefined, { cause: error });
  }
};
