import { http } from '../../tools/http/client';
import type { CommunityEventPage } from './types';

export interface CommunityEventMetadata {
  gameId: string;
  gameName?: string;
  updateTime: string;
}

const github = 'https://github.com/HCLonely/AWA-Helper/raw/refs/heads/main/community-event.json';
export const COMMUNITY_EVENT_SOURCES = {
  github,
  'https://gh-proxy.org/': `https://gh-proxy.org/${github}`,
  'https://cdn.gh-proxy.org/': `https://cdn.gh-proxy.org/${github}`,
  'https://axisnow.gh-proxy.org/': `https://axisnow.gh-proxy.org/${github}`
} as const;
export type CommunityEventSource = keyof typeof COMMUNITY_EVENT_SOURCES;

export const validateCommunityEventSource = (source: unknown): CommunityEventSource => {
  if (typeof source !== 'string' || !Object.hasOwn(COMMUNITY_EVENT_SOURCES, source)) {
    throw new Error('communityEventInvalidSource');
  }
  return source as CommunityEventSource;
};

/** 缺少进度目标并不能证明活动已开放。 */
export const isCommunityEventActive = (page: CommunityEventPage): boolean => !page.closed && !page.concluded && page.totalMinutes > 0 && page.playedMinutes < page.totalMinutes;

/** 使用任务运行器的本地日历月份，并包含年份。 */
export const parseCommunityEventMetadata = (value: unknown, now = new Date()): CommunityEventMetadata | undefined => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }
  const data = value as Record<string, unknown>;
  const gameId = typeof data.gameId === 'string' ? data.gameId.trim() : String(data.gameId);
  if (!/^[1-9]\d*$/.test(gameId) || !Number.isSafeInteger(Number(gameId)) ||
    typeof data.updateTime !== 'string' || !/^\d{4}-\d{2}-\d{2}T/.test(data.updateTime) ||
    (data.gameName !== undefined && typeof data.gameName !== 'string')) {
    return undefined;
  }
  const updated = new Date(data.updateTime);
  if (!Number.isFinite(updated.getTime()) || updated.getFullYear() !== now.getFullYear() || updated.getMonth() !== now.getMonth()) {
    return undefined;
  }
  return {
    gameId,
    gameName: typeof data.gameName === 'string' ? data.gameName.trim() : undefined,
    updateTime: updated.toISOString()
  };
};

export const fetchCommunityEventMetadata = async (source: CommunityEventSource = 'github'): Promise<CommunityEventMetadata> => {
  const url = COMMUNITY_EVENT_SOURCES[validateCommunityEventSource(source)];
  const response = await http.get<unknown>(url, {
    headers: {
      'Cache-Control': 'no-cache'
    }
  });
  const metadata = parseCommunityEventMetadata(response.data);
  if (!metadata) {
    throw new Error('communityEventDataRequired');
  }
  return metadata;
};
