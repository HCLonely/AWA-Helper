/** Selects the first live channel that exposes a usable Arena Rewards token. */
import { TwitchContext } from '../../TwitchContext';
import type { TwitchChannelTrackingInfo } from '../../types';
import { getExtensionInfo } from '../extensions';
import { getChannelInfo } from './getChannelInfo';

export const getChannelsInfo = async (context: TwitchContext, channelLogins: string[]): Promise<TwitchChannelTrackingInfo | null> => {
  for (const streamerName of channelLogins) {
    const channelId = await getChannelInfo(context, streamerName).catch(() => null);
    if (!channelId) continue;
    const extension = await getExtensionInfo(context, channelId).catch(() => null);
    if (extension?.jwt) return { channelId, streamerName, ...extension };
  }
  return null;
};
