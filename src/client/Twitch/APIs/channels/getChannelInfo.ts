/** Resolves a Twitch login to its channel id. */
import { http } from '../tools-path';
import { TwitchContext } from '../../TwitchContext';
import { TwitchError } from '../../TwitchError';
import { channelInfoQuery } from '../../queries';

export const getChannelInfo = async (context: TwitchContext, channelLogin: string): Promise<string | null> => {
  if (!context.clientId) throw new TwitchError('getChannelInfo', 'Twitch Client-Id is not initialized');
  const options: myAxiosConfig = {
    url: 'https://gql.twitch.tv/gql', method: 'POST',
    headers: { ...context.headers, 'Client-Id': context.clientId }, data: channelInfoQuery(channelLogin)
  };
  if (context.httpsAgent) options.httpsAgent = context.httpsAgent;
  try {
    const response = await http(options);
    return response.data?.[0]?.data?.user?.id || null;
  } catch (error) {
    throw new TwitchError('getChannelInfo', `Unable to resolve Twitch channel ${channelLogin}`, true, undefined, { cause: error });
  }
};
