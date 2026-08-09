/** Pure parser for Twitch channel GraphQL results. */
import type { TwitchGqlEnvelope } from '../types';

export interface TwitchChannelQueryData { user?: { id?: string } }

export const parseTwitchChannelId = (payload: Array<TwitchGqlEnvelope<TwitchChannelQueryData>>): string | null => payload[0]?.data?.user?.id || null;
