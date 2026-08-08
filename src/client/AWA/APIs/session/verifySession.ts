/** Verifies the AWA account session and captures user identity. */
import { load } from 'cheerio';
import { http } from '../tools-path';
import { AWAContext } from '../../AWAContext';
import { AWAError } from '../../AWAError';

export const verifySession = async (context: AWAContext): Promise<{ userId: string; username: string }> => {
  const options: myAxiosConfig = { url: `${context.baseURL}/account`, method: 'GET', headers: context.headers };
  if (context.httpsAgent) options.httpsAgent = context.httpsAgent;
  try {
    const response = await http(options);
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
