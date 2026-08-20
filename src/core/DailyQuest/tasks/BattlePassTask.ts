/**
 * @file src/core/DailyQuest/tasks/BattlePassTask.ts
 * @description 领取当前 AWA Battle Pass 中所有可领取奖励并验证最终状态。
 */
/* global __ */
import chalk from 'chalk';
import { Logger, time } from '../../../tools';
import type { BattlePassReward, BattlePassSnapshot } from '../../../client/AWA/types';
import type { BattlePassFailedState, BattlePassRunState } from '../DailyQuestState';
import { DailyQuestRuntime } from '../DailyQuestRuntime';

export class BattlePassTask {
  /**
   * 仅读取当前 Battle Pass 状态，供任务开始时立即展示进度。
   * @param runtime - 当前 DailyQuest 运行时。
   * @param signal - 任务取消信号。
   * @returns 页面存在且读取成功时返回 true。
   */
  static async inspect(runtime: DailyQuestRuntime, signal?: AbortSignal): Promise<boolean> {
    const url = runtime.state.battlePassUrl;
    if (!url || signal?.aborted) {
      return false;
    }
    const logger = new Logger(`${time()}${__('battlePassChecking')}`, false);
    try {
      const snapshot = await runtime.awa.battlePass.getPage(url);
      BattlePassTask.applySnapshot(runtime, snapshot);
      logger.log(snapshot.status === 'unknown' ? chalk.yellow(__('battlePassUnknown')) : chalk.green(__('logStatusOk')));
      return true;
    } catch (error) {
      logger.log(chalk.red(__('logStatusError')));
      new Logger(error);
      runtime.state.battlePass = { status: 'unknown', tokenCount: 0, tokenTotal: 0, claimed: [], failed: [] };
      return false;
    }
  }

  /**
   * 执行 Battle Pass 奖励领取。
   * @param runtime - 当前 DailyQuest 运行时。
   * @param signal - 任务取消信号。
   * @returns 是否顺利完成本次检查；单个奖励失败不会中止其他领取。
   */
  static async run(runtime: DailyQuestRuntime, signal?: AbortSignal): Promise<boolean> {
    const url = runtime.state.battlePassUrl;
    if (!url || signal?.aborted) {
      return true;
    }
    const logger = new Logger(`${time()}${__('battlePassChecking')}`, false);
    try {
      const snapshot = await runtime.awa.battlePass.getPage(url);
      const battlePass = BattlePassTask.applySnapshot(runtime, snapshot);
      if (snapshot.status !== 'active') {
        logger.log(snapshot.status === 'unknown' ? chalk.yellow(__('battlePassUnknown')) : chalk.green(__('logStatusOk')));
        return true;
      }

      const claimable = snapshot.rewards
        .filter((reward) => reward.state === 'unlockable' && !!reward.claim)
        .sort((left, right) => left.index - right.index);
      const accepted: BattlePassReward[] = [];
      for (const reward of claimable) {
        if (signal?.aborted) {
          return false;
        }
        const result = await runtime.awa.battlePass.claim(url, reward);
        if (result.ok) {
          accepted.push(reward);
        } else {
          battlePass.failed.push(BattlePassTask.failure(reward, result.reason));
        }
      }

      if (signal?.aborted) {
        return false;
      }
      if (accepted.length > 0) {
        const refreshed = await runtime.awa.battlePass.getPage(url);
        battlePass.status = refreshed.status;
        battlePass.tokenCount = refreshed.tokenCount;
        battlePass.tokenTotal = refreshed.tokenTotal;
        const claimedIds = new Set(refreshed.rewards
          .filter((reward) => reward.state === 'claimed')
          .map((reward) => reward.milestoneId));
        for (const reward of accepted) {
          if (claimedIds.has(reward.milestoneId)) {
            battlePass.claimed.push({
              name: reward.name,
              index: reward.index + 1,
              total: snapshot.rewards.length,
              milestoneId: reward.milestoneId
            });
          } else {
            battlePass.failed.push(BattlePassTask.failure(reward, 'verification-failed'));
          }
        }
      }
      logger.log(battlePass.failed.length > 0 ? chalk.yellow(__('battlePassPartial')) : chalk.green(__('logStatusOk')));
      return true;
    } catch (error) {
      logger.log(chalk.red(__('logStatusError')));
      new Logger(error);
      runtime.state.battlePass = { status: 'unknown', tokenCount: 0, tokenTotal: 0, claimed: [], failed: [] };
      return true;
    }
  }

  private static failure(reward: BattlePassReward, reason: string): BattlePassFailedState {
    return { name: reward.name, milestoneId: reward.milestoneId, reason };
  }

  private static applySnapshot(runtime: DailyQuestRuntime, snapshot: BattlePassSnapshot): BattlePassRunState {
    const state: BattlePassRunState = {
      status: snapshot.status, tokenCount: snapshot.tokenCount, tokenTotal: snapshot.tokenTotal, claimed: [], failed: []
    };
    runtime.state.battlePass = state;
    return state;
  }
}
