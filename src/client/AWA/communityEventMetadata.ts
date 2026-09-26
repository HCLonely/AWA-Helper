import { http } from '../../tools/http/client';
import type { CommunityEventListing, CommunityEventPage } from './types';

export interface CommunityEventMetadata {
  gameId: string;
  gameName?: string;
  eventPath?: string;
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
    (data.gameName !== undefined && typeof data.gameName !== 'string') ||
    (data.eventPath !== undefined && (typeof data.eventPath !== 'string' || (data.eventPath !== '' && !/^[a-z0-9-]+$/.test(data.eventPath))))) {
    return undefined;
  }
  const updated = new Date(data.updateTime);
  if (!Number.isFinite(updated.getTime()) || updated.getFullYear() !== now.getFullYear() || updated.getMonth() !== now.getMonth()) {
    return undefined;
  }
  return {
    gameId,
    gameName: typeof data.gameName === 'string' ? data.gameName.trim() : undefined,
    ...(data.eventPath ? {
      eventPath: String(data.eventPath)
    } : {}),
    updateTime: updated.toISOString()
  };
};

/** 兼容旧版单游戏、游戏数组和新版 games 数据结构。 */
export const communityEventEntries = (value: unknown): unknown[] => {
  if (Array.isArray(value)) {
    return value;
  }
  if (!value || typeof value !== 'object') {
    return [];
  }
  const data = value as Record<string, unknown>;
  if (Array.isArray(data.games)) {
    return data.games.map((game) => (game && typeof game === 'object' ? {
      updateTime: data.updateTime,
      ...game
    } : game));
  }
  return data.gameId ? [data] : [];
};

export const parseCommunityEventMetadataList = (value: unknown): CommunityEventMetadata[] => communityEventEntries(value)
  .map((entry) => parseCommunityEventMetadata(entry))
  .filter((entry): entry is CommunityEventMetadata => !!entry);

/** 优先使用明确活动路径，其次使用页面 Steam 链接或横幅游戏名；不按数组顺序猜测。 */
export const matchCommunityEventMetadata = (games: CommunityEventMetadata[], event: CommunityEventListing, page: CommunityEventPage): CommunityEventMetadata | undefined => {
  const title = event.title.split(/\s+Community Event\b/i)[0].trim().toLowerCase();
  const matches = games.filter((game) => {
    if (game.eventPath) {
      return game.eventPath === event.path && (!page.linkedGameId || page.linkedGameId === game.gameId);
    }
    return page.linkedGameId ? page.linkedGameId === game.gameId : !!game.gameName && game.gameName.trim().toLowerCase() === title;
  });
  return matches.length === 1 ? matches[0] : undefined;
};

export const fetchCommunityEventMetadata = async (source: CommunityEventSource = 'github'): Promise<CommunityEventMetadata[]> => {
  const url = COMMUNITY_EVENT_SOURCES[validateCommunityEventSource(source)];
  const response = await http.get<unknown>(url, {
    headers: {
      'Cache-Control': 'no-cache'
    }
  });
  const metadata = parseCommunityEventMetadataList(response.data);
  if (!metadata.length) {
    throw new Error('communityEventDataRequired');
  }
  return metadata;
};
