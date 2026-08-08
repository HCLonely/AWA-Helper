/** Retrieves the Arena Rewards Tracker extension token for a Twitch channel. */
import { http } from '../tools-path';
import { TwitchContext } from '../../TwitchContext';
import { TwitchError } from '../../TwitchError';
import { extensionInfoQuery } from '../../queries';

export interface TwitchExtensionInfo { extensionID?: string; jwt: string }

export const getExtensionInfo = async (context: TwitchContext, channelId: string): Promise<TwitchExtensionInfo | null> => {
  if (!context.clientId) throw new TwitchError('getExtensionInfo', 'Twitch Client-Id is not initialized');
  const options: myAxiosConfig = {
    url: 'https://gql.twitch.tv/gql', method: 'POST',
    headers: { ...context.headers, 'Client-Id': context.clientId }, data: extensionInfoQuery(channelId)
  };
  if (context.httpsAgent) options.httpsAgent = context.httpsAgent;
  try {
    const response = await http(options);
    const extensions = response.data?.[0]?.data?.user?.channel?.selfInstalledExtensions as Array<any> | undefined;
    const tracker = extensions?.find((extension) => extension?.installation?.extension?.name === 'Arena Rewards Tracker');
    const token = tracker?.token as TwitchExtensionInfo | undefined;
    return token?.jwt ? token : null;
  } catch (error) {
    throw new TwitchError('getExtensionInfo', `Unable to query extensions for channel ${channelId}`, true, undefined, { cause: error });
  }
};
