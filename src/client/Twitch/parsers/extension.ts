/** Pure parsers for linked and channel-installed Twitch extensions. */
import type { TwitchExtensionInfo, TwitchGqlEnvelope, TwitchInstalledExtension } from '../types';

export interface LinkedExtensionsData { currentUser?: { linkedExtensions?: Array<{ name?: string }> } }
export interface ChannelExtensionsData { user?: { channel?: { selfInstalledExtensions?: TwitchInstalledExtension[] } } }

export const parseLinkedArenaExtension = (payload: Array<TwitchGqlEnvelope<LinkedExtensionsData>>): boolean => !!payload[0]?.data?.currentUser?.linkedExtensions?.some(({ name }) => name === 'Arena Rewards Tracker');

export const parseArenaExtensionInfo = (payload: Array<TwitchGqlEnvelope<ChannelExtensionsData>>): TwitchExtensionInfo | null => {
  const tracker = payload[0]?.data?.user?.channel?.selfInstalledExtensions
    ?.find((extension) => extension.installation?.extension?.name === 'Arena Rewards Tracker');
  return tracker?.token?.jwt ? tracker.token : null;
};
