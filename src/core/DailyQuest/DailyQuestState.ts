/**
 * @file src/core/DailyQuest/DailyQuestState.ts
 * @description 定义单次每日任务运行期间共享的可变状态结构。
 */
import type { PromotionalCalendarEntry } from '../../client/AWA/types';
export type { GetStartedItem, PromotionalCalendarEntry } from '../../client/AWA/types';
export interface SteamCommunityEventState {
  path?: string;
  gameId?: string;
  gameName?: string;
  status: string;
  playedTime: string;
  totalTime: string
}
export interface BattlePassClaimedState {
  name: string;
  milestoneId: number
}
export interface BattlePassFailedState {
  name: string;
  milestoneId: number;
  reason: string
}
export interface BattlePassRunState {
  status: 'unknown' | 'not-started' | 'not-joined' | 'active' | 'completed' | 'ended';
  claimedCount: number;
  rewardTotal: number;
  claimed: BattlePassClaimedState[];
  failed: BattlePassFailedState[];
}

export class DailyQuestState {
  questInfo: questInfo = {};
  userProfileUrl?: string;
  dailyQuestLink?: string;
  controlCenterBattlePassUrl?: string;
  private readonly staleBattlePassUrls = new Set<string>();
  battlePass?: BattlePassRunState;
  additionalTwitchARP = 0;
  signArp: {
    daily?: string;
    monthly?: string
  } = {};
  promotionalCalendarInfo?: PromotionalCalendarEntry[];
  dailyArp = '0';
  taskType: 'US' | 'New' = 'New';
  posts: string[] = [];
  trackError = 0;
  trackTimes = 0;
  postReplied: boolean | null = null;
  communityEvents: SteamCommunityEventState[] = [];

  constructor(private readonly getPersonalizationBattlePassUrl: () => string | undefined = () => undefined) {}

  /** 读取时选择来源，确保个性化页面后续刷新也立即生效。 */
  get battlePassUrl(): string | undefined {
    const controlCenterUrl = this.controlCenterBattlePassUrl;
    if (controlCenterUrl && !this.staleBattlePassUrls.has(controlCenterUrl)) {
      return controlCenterUrl;
    }
    const personalizationUrl = this.getPersonalizationBattlePassUrl();
    return personalizationUrl && !this.staleBattlePassUrls.has(personalizationUrl) ? personalizationUrl : undefined;
  }

  /** 记住已失效的入口，避免 Control Center 刷新后再次选中同一旧链接。 */
  invalidateBattlePassUrl(url: string): void {
    this.staleBattlePassUrls.add(url);
  }

  /** 兼容旧的单活动调用方。 */
  get communityEvent(): SteamCommunityEventState | undefined {
    return this.communityEvents[0];
  }
  set communityEvent(value: SteamCommunityEventState | undefined) {
    this.communityEvents = value ? [value] : [];
  }
}
