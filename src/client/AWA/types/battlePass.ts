/**
 * @file src/client/AWA/types/battlePass.ts
 * @description 定义 AWA Battle Pass 页面、奖励和领取结果。
 */
export type BattlePassStatus = 'unknown' | 'not-started' | 'active' | 'completed' | 'ended';

export type BattlePassRewardState = 'unlockable' | 'claimed' | 'in_progress' | 'locked' | 'unknown';

export interface BattlePassReward {
  index: number;
  milestoneId: number;
  name: string;
  state: BattlePassRewardState;
  image?: string;
  description?: string;
  requiredArp?: number;
  progress?: { current: number; total: number };
  claim?: { path: string; csrfToken: string };
}

export interface BattlePassSnapshot {
  status: BattlePassStatus;
  tokenCount: number;
  tokenTotal: number;
  endsAt?: string;
  rewards: BattlePassReward[];
}

export interface BattlePassClaimSuccess {
  success: true;
  milestoneId: number;
  userMilestoneId: number;
}

export type BattlePassClaimResult =
  | { ok: true; data: BattlePassClaimSuccess }
  | { ok: false; reason: 'invalid-request' | 'rejected' | 'milestone-mismatch'; message?: string };
