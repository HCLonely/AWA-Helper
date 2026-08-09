/** Structured control-center values returned to DailyQuest Core. */
export interface PromotionalCalendarEntry { name: string; day: string; finished?: boolean }
export interface GetStartedItem { name: string; link: string }
export interface ControlCenterSnapshot {
  questInfo: questInfo;
  userProfileUrl?: string;
  dailyQuestLink?: string;
  dailyArp: string;
  taskType: 'US' | 'New';
  signArp: { daily?: string; monthly?: string };
  promotionalCalendarInfo?: PromotionalCalendarEntry[];
  posts: string[];
  getStartedItems: GetStartedItem[];
}
