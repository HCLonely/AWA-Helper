/** Checks whether Arena Rewards Tracker is linked to the Twitch account. */
import { http } from '../tools-path';
import { TwitchContext } from '../../TwitchContext';
import { TwitchError } from '../../TwitchError';
import { linkedExtensionsQuery } from '../../queries';

export const checkLinkedExtension = async (context: TwitchContext): Promise<boolean> => {
  if (!context.clientId) throw new TwitchError('checkLinkedExtension', 'Twitch Client-Id is not initialized');
  const options: myAxiosConfig = {
    url: 'https://gql.twitch.tv/gql', method: 'POST',
    headers: { ...context.headers, 'Client-Id': context.clientId }, data: linkedExtensionsQuery
  };
  if (context.httpsAgent) options.httpsAgent = context.httpsAgent;
  try {
    const response = await http(options);
    return !!response.data?.[0]?.data?.currentUser?.linkedExtensions
      ?.find((extension: { name?: string }) => extension.name === 'Arena Rewards Tracker');
  } catch (error) {
    throw new TwitchError('checkLinkedExtension', 'Unable to query linked Twitch extensions', true, undefined, { cause: error });
  }
};
