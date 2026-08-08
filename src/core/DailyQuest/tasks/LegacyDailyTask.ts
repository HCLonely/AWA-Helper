/**
 * @file LegacyDailyTask
 * @description Matches historical task titles and executes their configured fallback actions.
 */
/* global __ */
import chalk from 'chalk';
import { Logger, sleep, random, time } from '../../../tools';
import type { AWAClient } from '../../../client/AWA/AWAClient';

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

  constructor(private readonly awa: AWAClient, { awaDailyQuestType }: {
    awaDailyQuestType?: Array<string>
  }) {
    if (awaDailyQuestType) {
      this.awaDailyQuestType = awaDailyQuestType;
    }
  }

  async do(): Promise<any> {
    if (!this.awa.questInfo.dailyQuest?.[0]) {
      return new Logger(time() + chalk.yellow(__('noDailyQuest')));
    }

    if (this.checkDailyQuestCompleted()) {
      return;
    }

    for (const { name } of this.awa.questInfo.dailyQuest) {
      const matchedQuest = this.matchQuest(name);
      if (matchedQuest.length > 0) {
        for (const quest of matchedQuest) {
          // @ts-ignore
          if (this[quest] && this.awaDailyQuestType.includes(quest)) {
            // @ts-ignore
            await this[quest]();
          } else if (/^\//.test(quest)) {
            await this.awa.openLink(`https://${globalThis.awaHost}${quest}`);
          }
          this.done.push(quest);
          await sleep(random(1, 2));
        }
        await this.awa.updateDailyQuests();
        if (this.checkDailyQuestCompleted()) {
          return;
        }
      }
    }

    // if (this.awaDailyQuestType.includes('changeBorder') && !this.done.includes('changeBorder')) await globalThis.quest.changeBorder();
    // if (this.awaDailyQuestType.includes('changeAvatar') && !this.done.includes('changeAvatar')) await globalThis.quest.changeAvatar();
    if (this.awaDailyQuestType.includes('viewNews') && !this.done.includes('viewNews')) await this.awa.viewNews();
    if (this.awaDailyQuestType.includes('sharePost') && !this.done.includes('sharePost')) await this.awa.sharePosts();

    await this.awa.updateDailyQuests();
    if (this.checkDailyQuestCompleted()) {
      return;
    }

    if (this.awaDailyQuestType.includes('openLink')) {
      const linksPathname = ['/rewards/leaderboard', '/rewards', '/marketplace/', '/ucf/Video', '/faq-contact', '/account/personalization'];
      for (const pathname of linksPathname) {
        if (!this.done.includes(pathname)) {
          await this.awa.openLink(`https://${globalThis.awaHost}${pathname}`);
          await sleep(random(1, 3));
        }
      }
    }
    await this.awa.updateDailyQuests();
    if (this.checkDailyQuestCompleted()) {
      return;
    }
    if (this.awaDailyQuestType.includes('replyPost') && !this.done.includes('replyPost')) {
      await this.awa.replyPost();
      await this.awa.updateDailyQuests();
      if (this.checkDailyQuestCompleted()) {
        return;
      }
    }
    return new Logger(time() + chalk.red(__('dailyQuestNotCompleted')));
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

  matchQuest(dailyQuestName: string): Array<string> {
    const logger = new Logger(`${time()}${__('matchingDailyQuestDb')}`, false);
    if (!dailyQuestName) {
      logger.log(chalk.yellow(__('notMatchedDailyQuest')));
      return [];
    }
    const { quests } = dailyQuestDbJson;

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
