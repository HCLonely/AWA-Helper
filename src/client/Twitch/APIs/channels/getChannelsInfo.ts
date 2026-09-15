/**
 * @file src/client/Twitch/APIs/channels/getChannelsInfo.ts
 * @description 从候选 Twitch 频道中选择具有可用奖励扩展的直播频道。
 */
import { getRequestSignal } from '../../../../tools/http/RequestContext';
import { TwitchContext } from '../../TwitchContext';
import type { TwitchChannelTrackingInfo } from '../../types';
import type { LookupResult } from '../../../shared';
import { getExtensionInfo } from '../extensions';
import { getChannelInfo } from './getChannelInfo';

/**
 * 获取 get Channels Info 相关数据。
 * @param context - 发起远程请求及保存会话状态所需的客户端上下文，类型为 `TwitchContext`。
 * @param channelLogins - 用于查询直播状态的 Twitch 频道登录名列表，类型为 `string[]`。
 * @returns 找到可跟踪频道时返回频道与扩展信息，否则返回 `no-trackable-channel`。
 */
export const getChannelsInfo = async (context: TwitchContext, channelLogins: string[]): Promise<LookupResult<TwitchChannelTrackingInfo, 'no-trackable-channel'>> => {
  for (const streamerName of new Set(channelLogins)) {
    getRequestSignal()?.throwIfAborted();
    const channel = await getChannelInfo(context, streamerName).catch(() => ({ found: false as const, reason: 'not-found' as const }));
    if (!channel.found) {
      continue;
    }
    const extension = await getExtensionInfo(context, channel.value).catch(() => ({ found: false as const, reason: 'not-found' as const }));
    if (extension.found && extension.value.jwt) {
      return { found: true, value: { channelId: channel.value, streamerName, ...extension.value } };
    }
  }
  return { found: false, reason: 'no-trackable-channel' };
};
