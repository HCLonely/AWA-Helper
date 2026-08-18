/**
 * @file src/core/DailyQuest/tasks/DailyTask.ts
 * @description 识别并完成当前版本的 AWA 每日任务，包括领奖和入门任务。
 */
/* global __ */
import chalk from 'chalk';
import { Logger, time } from '../../../tools';
import type { DailyQuestRuntime } from '../DailyQuestRuntime';

class DailyTask {
  /**
   * 初始化 Daily Task 实例。
   * @param runtime - 当前任务使用的运行时实例，类型为 `DailyQuestRuntime`。
   */
  constructor(private readonly runtime: DailyQuestRuntime) {}
  /**
   * 处理 do 相关逻辑。
   * @param signal - 用于停止后续账户操作的中止信号。
   * @returns `Promise<boolean>`，表示 do 检查是否通过。
   */
  async do(signal?: AbortSignal): Promise<boolean> {
    if (signal?.aborted) {
      return false;
    }
    if (!this.runtime.state.questInfo.dailyQuest?.[0]) {
      new Logger(time() + chalk.yellow(__('noDailyQuest')));
      return true;
    }

    if (this.checkDailyQuestCompleted()) {
      return true;
    }
    for (const questInfo of this.runtime.state.questInfo.dailyQuest) {
      if (signal?.aborted) {
        return false;
      }
      if (questInfo.id) {
        await this.runtime.claimQuest(questInfo.id);
        if (signal?.aborted) {
          return false;
        }
        await this.runtime.updateDailyQuests();
        if (this.checkDailyQuestCompleted()) {
          return true;
        }
      }
    }
    if (this.runtime.state.dailyQuestLink) {
      await this.runtime.visit(this.runtime.state.dailyQuestLink, signal);
      if (signal?.aborted) {
        return false;
      }
      const postId = this.runtime.state.dailyQuestLink.match(/ucf\/show\/([\d]+)/)?.[1];
      if (postId) {
        await this.runtime.viewPost(postId, signal);
        if (signal?.aborted) {
          return false;
        }
      }
      await this.runtime.updateDailyQuests();
      if (this.checkDailyQuestCompleted()) {
        return true;
      }
    }

    new Logger(time() + chalk.red(__('dailyQuestNotCompleted')));
    return true;
  }
  /**
   * 检查 check Daily Quest Completed 相关数据。
   * @returns `boolean`，表示 checkDailyQuestCompleted 检查是否通过。
   */
  private checkDailyQuestCompleted(): boolean {
    if ((this.runtime.state.questInfo.dailyQuest || []).filter((e: { status: string; }) => e.status === 'complete').length === (this.runtime.state.questInfo.dailyQuest || []).length) {
      if ((this.runtime.state.questInfo.dailyQuest?.length || 0) < 2) {
        new Logger(time() + chalk.green(__('dailyQuestCompleted')));
      }
      return true;
    }
    return false;
  }
}

export { DailyTask };
