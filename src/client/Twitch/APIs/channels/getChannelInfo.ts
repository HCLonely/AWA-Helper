/** Resolves a Twitch login to its channel id. */
import { TwitchContext } from '../../TwitchContext';
import { TwitchError } from '../../TwitchError';
import { channelInfoQuery } from '../../queries';
import { parseTwitchChannelId, type TwitchChannelQueryData } from '../../parsers';
import type { TwitchGqlEnvelope } from '../../types';

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
