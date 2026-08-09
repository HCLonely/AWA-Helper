/**
 * @file src/core/DailyQuest/DailyQuestState.ts
 * @description 定义单次每日任务运行期间共享的可变状态结构。
 */
import type { PromotionalCalendarEntry } from '../../client/AWA/types';
export type { GetStartedItem, PromotionalCalendarEntry } from '../../client/AWA/types';
export interface SteamCommunityEventState { path?: string; gameId?: string; status: string; playedTime: string; totalTime: string }

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
