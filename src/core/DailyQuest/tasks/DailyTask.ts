/**
 * @file DailyTask
 * @description Claims and completes current-generation AWA daily tasks.
 */
/* global __ */
import chalk from 'chalk';
import { Logger, time } from '../../../tools';
import type { AWAClient } from '../../../client/AWA/AWAClient';

class DailyTask {
  constructor(private readonly awa: AWAClient) {}
  async do(): Promise<any> {
    if (!this.awa.questInfo.dailyQuest?.[0]) {
      new Logger(time() + chalk.yellow(__('noDailyQuest')));
      return true;
    }

    if (this.checkDailyQuestCompleted()) {
      return true;
    }
    for (const questInfo of this.awa.questInfo.dailyQuest) {
      if (questInfo.id) {
        await this.awa.questAward(questInfo.id);
        await this.awa.updateDailyQuests();
        if (this.checkDailyQuestCompleted()) {
          return true;
        }
      }
    }
    if (this.awa.dailyQuestLink) {
      await this.awa.openLink(this.awa.dailyQuestLink);
      const postId = this.awa.dailyQuestLink.match(/ucf\/show\/([\d]+)/)?.[1];
      if (postId) {
        await this.awa.viewPost(postId);
      }
      await this.awa.updateDailyQuests();
      if (this.checkDailyQuestCompleted()) {
        return true;
      }
    }

    new Logger(time() + chalk.red(__('dailyQuestNotCompleted')));
    return true;
  }
  private checkDailyQuestCompleted(): boolean {
    if ((this.awa.questInfo.dailyQuest || []).filter((e: { status: string; }) => e.status === 'complete').length === (this.awa.questInfo.dailyQuest || []).length) {
      if ((this.awa.questInfo.dailyQuest?.length || 0) < 2) {
        new Logger(time() + chalk.green(__('dailyQuestCompleted')));
      }
      return true;
    }
    return false;
  }
}

export { DailyTask };
