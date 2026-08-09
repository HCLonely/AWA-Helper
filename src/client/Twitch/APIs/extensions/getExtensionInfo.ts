/** Retrieves the Arena Rewards Tracker extension token for a Twitch channel. */
import { TwitchContext } from '../../TwitchContext';
import { TwitchError } from '../../TwitchError';
import { extensionInfoQuery } from '../../queries';
import { parseArenaExtensionInfo, type ChannelExtensionsData } from '../../parsers';
import type { TwitchExtensionInfo, TwitchGqlEnvelope } from '../../types';
export type { TwitchExtensionInfo } from '../../types';

export const getExtensionInfo = async (context: TwitchContext, channelId: string): Promise<TwitchExtensionInfo | null> => {
  if (!context.clientId) throw new TwitchError('getExtensionInfo', 'Twitch Client-Id is not initialized');
  const options: myAxiosConfig = {
    url: 'https://gql.twitch.tv/gql', method: 'POST',
    headers: { ...context.headers, 'Client-Id': context.clientId }, data: extensionInfoQuery(channelId)
  };
  if (context.httpsAgent) options.httpsAgent = context.httpsAgent;
  try {
    const response = await context.request<Array<TwitchGqlEnvelope<ChannelExtensionsData>>>(options);
    return parseArenaExtensionInfo(response.data);
  } catch (error) {
    throw new TwitchError('getExtensionInfo', `Unable to query extensions for channel ${channelId}`, true, undefined, { cause: error });
  }
};
