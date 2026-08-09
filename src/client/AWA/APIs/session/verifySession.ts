/**
 * @file src/client/AWA/APIs/session/verifySession.ts
 * @description 验证 AWA 会话 Cookie，并记录当前账户的用户标识与用户名。
 */
import { load } from 'cheerio';
import { AWAContext } from '../../AWAContext';
import { AWAError } from '../../AWAError';

/**
 * 检查 verify Session 相关数据。
 * @param context - 发起远程请求及保存会话状态所需的客户端上下文，类型为 `AWAContext`。
 * @returns `Promise<{ userId: string; username: string; }>`，表示 verifySession 的检查结论。
 */
export const verifySession = async (context: AWAContext): Promise<{ userId: string; username: string }> => {
  const options: myAxiosConfig = { url: `${context.baseURL}/account`, method: 'GET', headers: context.headers };
  if (context.httpsAgent) options.httpsAgent = context.httpsAgent;
  try {
    const response = await context.request<string>(options);
    const $ = load(response.data);
    if ($('a.nav-link-login').length) throw new AWAError('verifySession', 'AWA cookie has expired', false, 602);
    const userId = String(response.data).match(/(?:var|let)\s+user_id\s*=\s*([\d]+);/)?.[1];
    const username = String(response.data).match(/(?:var|let)\s+user_username\s*=\s*"([\w]+)";/)?.[1];
    if (!userId || !username) throw new AWAError('verifySession', 'AWA account identity was not found');
    context.userId = userId;
    context.username = username;
    return { userId, username };
  } catch (error) {
    if (error instanceof AWAError) throw error;
    throw new AWAError('verifySession', 'Unable to verify AWA session', true, undefined, { cause: error });
  }
};
