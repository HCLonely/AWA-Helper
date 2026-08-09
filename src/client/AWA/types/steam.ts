/** Structured AWA Steam quest data shared by APIs, parsers, and Core tasks. */
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

export interface CommunityEventPage {
  path?: string;
  concluded: boolean;
  closed: boolean;
  gameId?: string;
  gameName?: string;
  started: boolean;
  playedMinutes: number;
  totalMinutes: number;
}
