/* global __ */
import * as chalk from 'chalk';
import { Logger, sleep, random, time } from './tool';

import * as dailyQuestDbJson from './dailyQuestDb.json';

class DailyQuestOld {
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

  constructor({ awaDailyQuestType }: {
    awaDailyQuestType?: Array<string>
  }) {
    if (awaDailyQuestType) {
      this.awaDailyQuestType = awaDailyQuestType;
    }
  }

  async do(): Promise<any> {
    if (!globalThis.quest.dailyQuestName[0]) {
      return new Logger(time() + chalk.yellow(__('noDailyQuest')));
    }

    if (this.checkDailyQuestCompleted()) {
      return;
    }

    for (const dailyQuestName of globalThis.quest.dailyQuestName) {
      const matchedQuest = this.matchQuest(dailyQuestName);
      if (matchedQuest.length > 0) {
        for (const quest of matchedQuest) {
          // @ts-ignore
          if (this[quest] && this.awaDailyQuestType.includes(quest)) {
            // @ts-ignore
            await this[quest]();
          } else if (/^\//.test(quest)) {
            await globalThis.quest.openLink(`https://${globalThis.awaHost}${quest}`);
          }
          this.done.push(quest);
          await sleep(random(1, 2));
        }
        await globalThis.quest.updateDailyQuests();
        if (this.checkDailyQuestCompleted()) {
          return;
        }
      }
    }

    if (this.awaDailyQuestType.includes('changeBorder') && !this.done.includes('changeBorder')) await globalThis.quest.changeBorder();
    if (this.awaDailyQuestType.includes('changeAvatar') && !this.done.includes('changeAvatar')) await globalThis.quest.changeAvatar();
    if (this.awaDailyQuestType.includes('viewNews') && !this.done.includes('viewNews')) await globalThis.quest.viewNews();
    if (this.awaDailyQuestType.includes('sharePost') && !this.done.includes('sharePost')) await globalThis.quest.sharePosts();

    await globalThis.quest.updateDailyQuests();
    if (this.checkDailyQuestCompleted()) {
      return;
    }

    if (this.awaDailyQuestType.includes('openLink')) {
      const linksPathname = ['/rewards/leaderboard', '/rewards', '/marketplace/', '/ucf/Video', '/faq-contact', '/account/personalization'];
      for (const pathname of linksPathname) {
        if (!this.done.includes(pathname)) {
          await globalThis.quest.openLink(`https://${globalThis.awaHost}${pathname}`);
          await sleep(random(1, 3));
        }
      }
    }
    await globalThis.quest.updateDailyQuests();
    if (this.checkDailyQuestCompleted()) {
      return;
    }
    if (this.awaDailyQuestType.includes('replyPost') && !this.done.includes('replyPost')) {
      await globalThis.quest.replyPost();
      await globalThis.quest.updateDailyQuests();
      if (this.checkDailyQuestCompleted()) {
        return;
      }
    }
    return new Logger(time() + chalk.red(__('dailyQuestNotCompleted')));
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

export { DailyQuestOld };
