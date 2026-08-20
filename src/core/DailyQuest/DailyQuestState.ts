/**
 * @file src/core/DailyQuest/DailyQuestState.ts
 * @description 定义单次每日任务运行期间共享的可变状态结构。
 */
import type { PromotionalCalendarEntry } from '../../client/AWA/types';
export type { GetStartedItem, PromotionalCalendarEntry } from '../../client/AWA/types';
export interface SteamCommunityEventState { path?: string; gameId?: string; status: string; playedTime: string; totalTime: string }
export interface BattlePassClaimedState { name: string; index: number; total: number; milestoneId: number }
export interface BattlePassFailedState { name: string; milestoneId: number; reason: string }
export interface BattlePassRunState {
  status: 'unknown' | 'not-started' | 'active' | 'completed' | 'ended';
  tokenCount: number;
  tokenTotal: number;
  claimed: BattlePassClaimedState[];
  failed: BattlePassFailedState[];
}

export class DailyQuestState {
  questInfo: questInfo = {};
  userProfileUrl?: string;
  dailyQuestLink?: string;
  battlePassUrl?: string;
  battlePass?: BattlePassRunState;
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
