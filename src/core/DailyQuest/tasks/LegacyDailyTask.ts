/**
 * @file src/core/DailyQuest/tasks/LegacyDailyTask.ts
 * @description 匹配旧版每日任务标题，并执行对应的浏览、头像或论坛操作。
 */
/* global __ */
import chalk from 'chalk';
import { Logger, sleep, random, time } from '../../../tools';
import type { DailyQuestRuntime } from '../DailyQuestRuntime';

import * as dailyQuestDbJson from '../../../data/dailyQuestDb.json';

class LegacyDailyTask {
  awaDailyQuestType = [
    'click',
    'visitLink',
    'openLink',
    'changeBorder',
    'changeAvatar',
    'viewNews',
    'sharePost'
  ];
  done: Array<string> = [];

  /**
   * 初始化 LegacyDailyTask 实例。
   * @param runtime - 当前任务使用的运行时实例，类型为 `DailyQuestRuntime`。
   * @param options - 创建实例或执行操作所需的配置选项，类型为 `{ awaDailyQuestType?: Array<string>; }`。
   */
  constructor(private readonly runtime: DailyQuestRuntime, {
    awaDailyQuestType
  }: {
    awaDailyQuestType?: Array<string>
  }) {
    if (awaDailyQuestType) {
      this.awaDailyQuestType = awaDailyQuestType;
    }
  }

  /**
   * 执行任务操作。
   * @param signal - 用于停止后续账户操作的中止信号。
   * @returns `Promise<boolean>`，表示旧版每日任务是否已完成或当前没有可处理任务。
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

    for (const {
      name
    } of this.runtime.state.questInfo.dailyQuest) {
      if (signal?.aborted) {
        return false;
      }
      const matchedQuest = this.matchQuest(name);
      if (matchedQuest.length > 0) {
        for (const quest of matchedQuest) {
          if (signal?.aborted) {
            return false;
          }
          const action = this.getAction(quest, signal);
          if (action && this.awaDailyQuestType.includes(quest)) {
            await action();
          } else if (/^\//.test(quest)) {
            await this.runtime.visit(new URL(quest, `${this.runtime.awa.context.baseURL}/`).href, signal);
          }
          if (signal?.aborted) {
            return false;
          }
          this.done.push(quest);
          if (!await sleep(random(1, 2), signal)) {
            return false;
          }
        }
        await this.runtime.updateDailyQuests();
        if (this.checkDailyQuestCompleted()) {
          return true;
        }
      }
    }

    if (this.awaDailyQuestType.includes('viewNews') && !this.done.includes('viewNews')) {
      await this.runtime.viewNews(signal);
      if (signal?.aborted) {
        return false;
      }
    }
    if (this.awaDailyQuestType.includes('sharePost') && !this.done.includes('sharePost')) {
      await this.runtime.sharePosts(undefined, signal);
      if (signal?.aborted) {
        return false;
      }
    }

    await this.runtime.updateDailyQuests();
    if (signal?.aborted) {
      return false;
    }
    if (this.checkDailyQuestCompleted()) {
      return true;
    }

    if (this.awaDailyQuestType.includes('openLink')) {
      const linksPathname = ['/rewards/leaderboard', '/rewards', '/marketplace/', '/ucf/Video', '/faq-contact', '/account/personalization'];
      for (const pathname of linksPathname) {
        if (signal?.aborted) {
          return false;
        }
        if (!this.done.includes(pathname)) {
          await this.runtime.visit(new URL(pathname, `${this.runtime.awa.context.baseURL}/`).href, signal);
          if (!await sleep(random(1, 3), signal)) {
            return false;
          }
        }
      }
    }
    await this.runtime.updateDailyQuests();
    if (signal?.aborted) {
      return false;
    }
    if (this.checkDailyQuestCompleted()) {
      return true;
    }
    if (this.awaDailyQuestType.includes('replyPost') && !this.done.includes('replyPost')) {
      await this.runtime.replyPost(undefined, signal);
      if (signal?.aborted) {
        return false;
      }
      await this.runtime.updateDailyQuests();
      if (this.checkDailyQuestCompleted()) {
        return true;
      }
    }
    new Logger(time() + chalk.red(__('dailyQuestNotCompleted')));
    return false;
  }

  /**
   * 获取任务对应操作。
   * @param name - 用于定位目标对象的名称，类型为 `string`。
   * @param signal - 用于停止后续账户操作的中止信号。
   * @returns `(() => Promise<unknown>) | undefined`，getAction 获取到的数据。
   */
  private getAction(name: string, signal?: AbortSignal): (() => Promise<unknown>) | undefined {
    const actions: Record<string, () => Promise<unknown>> = {
      /**
       * 更换边框。
       * @returns `Promise<boolean>`，表示 changeBorder 检查是否通过。
       */
      changeBorder: () => this.runtime.refreshPersonalization('border', signal),
      /**
       * 更换头像。
       * @returns `Promise<boolean>`，表示 changeAvatar 检查是否通过。
       */
      changeAvatar: () => this.runtime.refreshPersonalization('avatar', signal),
      /**
       * 浏览新闻。
       * @returns `Promise<void>`，异步操作完成后兑现，不携带结果值。
       */
      viewNews: () => this.runtime.viewNews(signal),
      /**
       * 批量分享帖子。
       * @returns `Promise<boolean>`，表示 sharePosts 检查是否通过。
       */
      sharePosts: () => this.runtime.sharePosts(undefined, signal),
      /**
       * 回复帖子。
       * @returns `Promise<boolean>`，表示 replyPost 检查是否通过。
       */
      replyPost: () => this.runtime.replyPost(undefined, signal)
    };
    return actions[name];
  }
  /**
   * 检查每日任务是否完成。
   * @returns `boolean`，表示 checkDailyQuestCompleted 检查是否通过。
   */
  private checkDailyQuestCompleted(): boolean {
    if ((this.runtime.state.questInfo.dailyQuest || []).filter((e: {
      status: string;
    }) => e.status === 'complete').length === (this.runtime.state.questInfo.dailyQuest || []).length) {
      if ((this.runtime.state.questInfo.dailyQuest?.length || 0) < 2) {
        new Logger(time() + chalk.green(__('dailyQuestCompleted')));
      }
      return true;
    }
    return false;
  }

  /**
   * 匹配任务。
   * @param dailyQuestName - 用于定位目标对象的名称，类型为 `string`。
   * @returns `string[]`，matchQuest 收集或筛选得到的数据列表。
   */
  matchQuest(dailyQuestName: string): Array<string> {
    const logger = new Logger(`${time()}${__('matchingDailyQuestDb')}`, false);
    if (!dailyQuestName) {
      logger.log(chalk.yellow(__('notMatchedDailyQuest')));
      return [];
    }
    const {
      quests
    } = dailyQuestDbJson;

    const matchedQuest = Object.entries(quests).map(([key, value]) => {
      if (
        value.includes(dailyQuestName) ||
        value.map((e) => e.toLowerCase()).includes(dailyQuestName.toLowerCase()) ||
        value.map((e) => e.toLowerCase().replace(/,|\.|\/|\\|'|"|:|;|!|#|\*|\?|<|>|\[|\]|\{|\}|\+|-|=|`|@|\$|%|\^|&|\(|~|\)|\||[\s]/g, '')).includes(dailyQuestName.toLowerCase().replace(/,|\.|\/|\\|'|"|:|;|!|#|\*|\?|<|>|\[|\]|\{|\}|\+|-|=|`|@|\$|%|\^|&|\(|~|\)|\||[\s]/g, ''))
      ) {
        return key;
      }
      return '';
    }).filter((e) => e);
    if (matchedQuest.length > 0) {
      logger.log(chalk.green(__('success')));
      return matchedQuest;
    }
    logger.log(chalk.yellow(__('notMatchedDailyQuest')));
    return [];
  }
}

export { LegacyDailyTask };
