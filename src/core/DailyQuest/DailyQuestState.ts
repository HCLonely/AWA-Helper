/** Mutable state owned by one Manager-started DailyQuest run. */
export interface PromotionalCalendarEntry { name: string; day: string; finished?: boolean }
export interface SteamCommunityEventState { path?: string; gameId?: string; status: string; playedTime: string; totalTime: string }
export interface GetStartedItem { name: string; link: string }

export class DailyQuestState {
  questInfo: questInfo = {};
  userProfileUrl?: string;
  dailyQuestLink?: string;
  additionalTwitchARP = 0;
  signArp: { daily?: string; monthly?: string } = {};
  promotionalCalendarInfo?: PromotionalCalendarEntry[];
  dailyArp = '0';
  taskType: 'US' | 'New' = 'New';
  posts: string[] = [];
  trackError = 0;
  trackTimes = 0;
  postReplied: boolean | null = null;
  communityEvent?: SteamCommunityEventState;
}
