/** Checks whether Arena Rewards Tracker is linked to the Twitch account. */
import { TwitchContext } from '../../TwitchContext';
import { TwitchError } from '../../TwitchError';
import { linkedExtensionsQuery } from '../../queries';
import { parseLinkedArenaExtension, type LinkedExtensionsData } from '../../parsers';
import type { TwitchGqlEnvelope } from '../../types';

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
