/**
 * @file src/client/Twitch/APIs/channels/getChannelsInfo.ts
 * @description 从候选 Twitch 频道中选择具有可用奖励扩展的直播频道。
 */
import { TwitchContext } from '../../TwitchContext';
import type { TwitchChannelTrackingInfo } from '../../types';
import { getExtensionInfo } from '../extensions';
import { getChannelInfo } from './getChannelInfo';

/**
 * 获取 get Channels Info 相关数据。
 * @param context - 发起远程请求及保存会话状态所需的客户端上下文，类型为 `TwitchContext`。
 * @param channelLogins - 用于查询直播状态的 Twitch 频道登录名列表，类型为 `string[]`。
 * @returns `Promise<TwitchChannelTrackingInfo | null>`，getChannelsInfo 获取到的数据。
 */
export const getChannelsInfo = async (context: TwitchContext, channelLogins: string[]): Promise<TwitchChannelTrackingInfo | null> => {
  for (const streamerName of channelLogins) {
    const channelId = await getChannelInfo(context, streamerName).catch(() => null);
    if (!channelId) continue;
    const extension = await getExtensionInfo(context, channelId).catch(() => null);
    if (extension?.jwt) return { channelId, streamerName, ...extension };
  }
  return null;
};
