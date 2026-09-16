/**
 * @file src/client/AWA/types/quests.ts
 * @description 定义 AWA 控制中心返回的每日任务、签到和积分状态。
 */
export interface PromotionalCalendarEntry {
  name: string;
  day: string;
  finished?: boolean
}
export interface GetStartedItem {
  name: string;
  link: string
}
export interface ControlCenterSnapshot {
  questInfo: questInfo;
  userProfileUrl?: string;
  dailyQuestLink?: string;
  dailyArp: string;
  taskType: 'US' | 'New';
  signArp: {
    daily?: string;
    monthly?: string
  };
  promotionalCalendarInfo?: PromotionalCalendarEntry[];
  posts: string[];
  getStartedItems: GetStartedItem[];
  battlePassUrl?: string;
}
