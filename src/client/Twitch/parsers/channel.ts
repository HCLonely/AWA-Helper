/**
 * @file src/client/Twitch/parsers/channel.ts
 * @description 解析 Twitch 频道 GraphQL 响应并提取跟踪所需信息。
 */
import type { TwitchGqlEnvelope } from '../types';

export interface TwitchChannelQueryData { user?: { id?: string } }

/**
 * 解析 parse Twitch Channel Id 相关数据。
 * @param payload - 当前请求或操作使用的数据内容，类型为 `TwitchGqlEnvelope<TwitchChannelQueryData>[]`。
 * @returns `string | null`，parseTwitchChannelId 解析得到的结构化结果。
 */
export const parseTwitchChannelId = (payload: Array<TwitchGqlEnvelope<TwitchChannelQueryData>>): string | null => payload[0]?.data?.user?.id || null;
