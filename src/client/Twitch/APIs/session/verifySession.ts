/** Validates Twitch credentials and discovers the current public Client-Id. */
import { load } from 'cheerio';
import { http } from '../tools-path';
import { TwitchContext } from '../../TwitchContext';
import { TwitchError } from '../../TwitchError';

export const verifySession = async (context: TwitchContext): Promise<string> => {
  if (!context.cookie.get('unique_id')) throw new TwitchError('verifySession', 'Missing unique_id in Twitch cookie');
  if (!context.cookie.get('auth-token')) throw new TwitchError('verifySession', 'Missing auth-token in Twitch cookie');
  const options: myAxiosConfig = {
    url: 'https://www.twitch.tv/', method: 'GET',
    headers: { Host: 'www.twitch.tv', 'User-Agent': context.headers['User-Agent'] }
  };
  if (context.httpsAgent) options.httpsAgent = context.httpsAgent;
  try {
    const response = await http(options);
    const $ = load(response.data);
    const script = $('script').filter((_, element) => !!$(element).html()?.includes('clientId')).first()
      .html();
    const clientId = script?.match(/clientId="(.+?)"/)?.[1];
    if (!clientId) throw new TwitchError('verifySession', 'Twitch Client-Id was not found in the page');
    context.clientId = clientId;
    return clientId;
  } catch (error) {
    if (error instanceof TwitchError) throw error;
    throw new TwitchError('verifySession', 'Unable to verify Twitch session', true, undefined, { cause: error });
  }
};
