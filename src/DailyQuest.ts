/*
 * @Author       : HCLonely
 * @Date         : 2025-07-18 09:14:08
 * @LastEditTime : 2025-08-22 19:21:54
 * @LastEditors  : HCLonely
 * @FilePath     : /AWA-Helper/src/DailyQuest.ts
 * @Description  : 每日任务
 */
/* global __ */
import * as chalk from 'chalk';
import { Logger, time } from './tool';

class DailyQuest {
  async do(): Promise<any> {
    if (!globalThis.quest.dailyQuestName[0]) {
      new Logger(time() + chalk.yellow(__('noDailyQuest')));
      return true;
    }

    if (this.checkDailyQuestCompleted()) {
      return true;
    }
    if (globalThis.quest.clickQuestId) {
      await globalThis.quest.questAward(globalThis.quest.clickQuestId);
      await globalThis.quest.updateDailyQuests();
      if (this.checkDailyQuestCompleted()) {
        return true;
      }
    }
    if (globalThis.quest.dailyQuestLink) {
      await globalThis.quest.openLink(globalThis.quest.dailyQuestLink);
      const postId = globalThis.quest.dailyQuestLink.match(/ucf\/show\/([\d]+)/)?.[1];
      if (postId) {
        await globalThis.quest.viewPost(postId);
      }
      await globalThis.quest.updateDailyQuests();
      if (this.checkDailyQuestCompleted()) {
        return true;
      }
    }

    new Logger(time() + chalk.red(__('dailyQuestNotCompleted')));
    return true;
  }
  private checkDailyQuestCompleted(): boolean {
    if ((globalThis.quest.questInfo.dailyQuest || []).filter((e: { status: string; }) => e.status === 'complete').length === (globalThis.quest.questInfo.dailyQuest || []).length) {
      if (globalThis.quest.dailyQuestNumber < 2) {
        new Logger(time() + chalk.green(__('dailyQuestCompleted')));
      }
      return true;
    }
    return false;
  }
}

export { DailyQuest };
