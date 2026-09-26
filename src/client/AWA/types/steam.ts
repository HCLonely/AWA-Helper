/**
 * @file src/client/AWA/types/steam.ts
 * @description 定义 AWA Steam 任务列表、详情、进度和社区活动数据。
 */
export interface AWASteamQuestListing {
  name: string;
  time: number;
  arp: number;
  link: string;
}

export interface AWASteamQuestDetail {
  appId: string;
  state: 'completed' | 'ownership-required' | 'ready' | 'selection-required' | 'not-started' | 'unknown';
}

export interface PreparedSteamQuest extends AWASteamQuestListing {
  id: string;
}

export interface CommunityEventListing {
  path: string;
  title: string;
}

export interface CommunityEventPage {
  path?: string;
  concluded: boolean;
  closed: boolean;
  gameId?: string;
  gameName?: string;
  linkedGameId?: string;
  owned: boolean;
  joined: boolean;
  playedMinutes: number;
  totalMinutes: number;
}
