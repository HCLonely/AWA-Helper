/**
 * @file DailyTask
 * @description Claims and completes current-generation AWA daily tasks.
 */
/* global __ */
import chalk from 'chalk';
import { Logger, time } from '../../../tools';
import type { DailyQuestRuntime } from '../DailyQuestRuntime';

class DailyTask {
  constructor(private readonly runtime: DailyQuestRuntime) {}
  async do(): Promise<any> {
    if (!this.runtime.state.questInfo.dailyQuest?.[0]) {
      new Logger(time() + chalk.yellow(__('noDailyQuest')));
      return true;
    }

    if (this.checkDailyQuestCompleted()) {
      return true;
    }
    for (const questInfo of this.runtime.state.questInfo.dailyQuest) {
      if (questInfo.id) {
        await this.runtime.claimQuest(questInfo.id);
        await this.runtime.updateDailyQuests();
        if (this.checkDailyQuestCompleted()) {
          return true;
        }
      }
    }
    if (this.runtime.state.dailyQuestLink) {
      await this.runtime.visit(this.runtime.state.dailyQuestLink);
      const postId = this.runtime.state.dailyQuestLink.match(/ucf\/show\/([\d]+)/)?.[1];
      if (postId) {
        await this.runtime.viewPost(postId);
      }
      await this.runtime.updateDailyQuests();
      if (this.checkDailyQuestCompleted()) {
        return true;
      }
    }

    new Logger(time() + chalk.red(__('dailyQuestNotCompleted')));
    return true;
  }
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
