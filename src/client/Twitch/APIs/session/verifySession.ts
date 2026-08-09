/**
 * @file src/client/Twitch/APIs/session/verifySession.ts
 * @description 验证 Twitch 登录 Cookie，并发现 GraphQL 请求所需的公共 Client-ID。
 */
import { TwitchContext } from '../../TwitchContext';
import { TwitchError } from '../../TwitchError';
import { parseTwitchClientId } from '../../parsers';

/**
 * 检查 verify Session 相关数据。
 * @param context - 发起远程请求及保存会话状态所需的客户端上下文，类型为 `TwitchContext`。
 * @returns `Promise<string>`，verifySession 获取或生成的文本内容。
 */
export const verifySession = async (context: TwitchContext): Promise<string> => {
  if (!context.cookie.get('unique_id')) throw new TwitchError('verifySession', 'Missing unique_id in Twitch cookie');
  if (!context.cookie.get('auth-token')) throw new TwitchError('verifySession', 'Missing auth-token in Twitch cookie');
  const options: myAxiosConfig = {
    url: 'https://www.twitch.tv/', method: 'GET',
    headers: { Host: 'www.twitch.tv', 'User-Agent': context.headers['User-Agent'] }
  };
  if (context.httpsAgent) options.httpsAgent = context.httpsAgent;
  try {
    const response = await context.request<string>(options);
    const clientId = parseTwitchClientId(response.data);
    if (!clientId) throw new TwitchError('verifySession', 'Twitch Client-Id was not found in the page');
    context.clientId = clientId;
    return clientId;
  } catch (error) {
    if (error instanceof TwitchError) throw error;
    console.debug(error);
    throw new TwitchError('verifySession', 'Unable to verify Twitch session', true, undefined, { cause: error });
  }
};
