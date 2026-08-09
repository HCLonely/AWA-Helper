/**
 * @file src/client/Twitch/parsers/extension.ts
 * @description 解析 Twitch 已关联扩展与频道安装扩展的 GraphQL 响应。
 */
import type { TwitchExtensionInfo, TwitchGqlEnvelope, TwitchInstalledExtension } from '../types';

export interface LinkedExtensionsData { currentUser?: { linkedExtensions?: Array<{ name?: string }> } }
export interface ChannelExtensionsData { user?: { channel?: { selfInstalledExtensions?: TwitchInstalledExtension[] } } }

/**
 * 解析 parse Linked Arena Extension 相关数据。
 * @param payload - 当前请求或操作使用的数据内容，类型为 `TwitchGqlEnvelope<LinkedExtensionsData>[]`。
 * @returns `boolean`，表示 parseLinkedArenaExtension 检查是否通过。
 */
export const parseLinkedArenaExtension = (payload: Array<TwitchGqlEnvelope<LinkedExtensionsData>>): boolean => !!payload[0]?.data?.currentUser?.linkedExtensions?.some(({ name }) => name === 'Arena Rewards Tracker');

/**
 * 解析 parse Arena Extension Info 相关数据。
 * @param payload - 当前请求或操作使用的数据内容，类型为 `TwitchGqlEnvelope<ChannelExtensionsData>[]`。
 * @returns `TwitchExtensionInfo | null`，parseArenaExtensionInfo 解析得到的结构化结果。
 */
export const parseArenaExtensionInfo = (payload: Array<TwitchGqlEnvelope<ChannelExtensionsData>>): TwitchExtensionInfo | null => {
  const tracker = payload[0]?.data?.user?.channel?.selfInstalledExtensions
    ?.find((extension) => extension.installation?.extension?.name === 'Arena Rewards Tracker');
  return tracker?.token?.jwt ? tracker.token : null;
};
