/**
 * Manager-owned DailyQuest runtime. It coordinates AWA APIs and owns task state,
 * while HTTP details and HTML parsing remain in client/AWA.
 */
/* global __ */
import * as fs from 'fs';
import dayjs from 'dayjs';
import { load } from 'cheerio';
import chalk from 'chalk';
import { AWAApiClient } from '../../client/AWA/AWAApiClient';
import {
  claimQuestAward, completeGetStartedItem, getControlCenter, getTwitchBonus, openPage, recordPostView,
  recordPromotionView, refreshSession, replyPost, sendTimeOnSiteTrack, sharePost
} from '../../client/AWA/APIs';
import { parseControlCenter } from '../../client/AWA/parsers';
import { Logger, random, sleep, time } from '../../tools';
import { DailyQuestState } from './DailyQuestState';
import { formatQuestReport } from './QuestReporter';
import { AWAError } from '../../client/AWA/AWAError';

export interface DailyQuestRuntimeOptions {
  awaCookie: string; host: string; proxy?: proxy; userAgent?: string;
  getStarted?: boolean; joinSteamCommunityEvent?: boolean;
}

export type DailyQuestRefreshResult =
  | { ok: true }
  | { ok: false; reason: 'network-rejected' | 'session-expired' | 'request-failed'; error?: unknown };

export class DailyQuestRuntime {
  readonly awa: AWAApiClient;
  readonly state = new DailyQuestState();
  private readonly getStarted: boolean;
  private readonly joinSteamCommunityEvent: boolean;

  constructor(options: DailyQuestRuntimeOptions) {
    this.awa = new AWAApiClient({ cookie: options.awaCookie, host: options.host, proxy: options.proxy, userAgent: options.userAgent });
    this.getStarted = !!options.getStarted;
    this.joinSteamCommunityEvent = !!options.joinSteamCommunityEvent;
  }

  get newCookie(): string { return this.awa.newCookie; }

  async init(): Promise<DailyQuestRefreshResult> {
    const logger = new Logger(`${time()}${__('updatingCookie', chalk.yellow('AWA Cookie'))}...`, false);
    try {
      await refreshSession(this.awa.context);
      logger.log(chalk.green('OK'));
      return this.updateDailyQuests(true);
    } catch (error) {
      logger.log(chalk.red('Error'));
      new Logger(error);
      if (error instanceof AWAError && error.statusCode === 610) return { ok: false, reason: 'network-rejected', error };
      if (error instanceof AWAError && error.statusCode === 602) return { ok: false, reason: 'session-expired', error };
      return { ok: false, reason: 'request-failed', error };
    }
  }

  async updateDailyQuests(verify = false): Promise<DailyQuestRefreshResult> {
    const logger = new Logger(time() + (verify ? __('verifyingToken', chalk.yellow('AWA Token')) : __('gettingTaskInfo')), false);
    try {
      const html = await getControlCenter(this.awa.context);
      if (html.toLowerCase().includes('we have detected an issue with your network')) {
        logger.log(chalk.red(__('ipBanned')));
        return { ok: false, reason: 'network-rejected' };
      }
      if (load(html)('a.nav-link-login').length) {
        logger.log(chalk.red(__('tokenExpired')));
        return { ok: false, reason: 'session-expired' };
      }
      const snapshot = parseControlCenter(html, this.awa.context.baseURL);
      this.state.questInfo = snapshot.questInfo;
      this.state.userProfileUrl = snapshot.userProfileUrl || this.state.userProfileUrl;
      this.state.dailyQuestLink = snapshot.dailyQuestLink;
      this.state.dailyArp = snapshot.dailyArp;
      this.state.taskType = snapshot.taskType;
      this.state.signArp = snapshot.signArp;
      this.state.promotionalCalendarInfo = snapshot.promotionalCalendarInfo;
      this.state.posts = snapshot.posts;
      logger.log(chalk.green('OK'));

      if (verify && snapshot.signArp.daily) new Logger(`${time()}${__('dailySign', chalk.green(snapshot.signArp.daily))}`);
      if (verify && snapshot.signArp.monthly) new Logger(`${time()}${__('monthlySign', chalk.green(snapshot.signArp.monthly))}`);
      if (verify && snapshot.promotionalCalendarInfo?.some(({ finished }) => !finished)) {
        new Logger(`${time()}${chalk.green(__('promotionalAlert'))}`);
      }

      if (verify && this.getStarted) {
        for (const item of snapshot.getStartedItems) {
          const itemLogger = new Logger(`${time()}${__('doingGetStartedQuest', chalk.yellow(item.name))}`, false);
          try {
            const completed = await completeGetStartedItem(this.awa.context, item.link);
            itemLogger.log(completed ? chalk.green('OK') : chalk.red('Error'));
          } catch (error) {
            itemLogger.log(chalk.red('Error'));
            new Logger(error);
          }
        }
      }
      if (verify && this.joinSteamCommunityEvent) await this.initializeCommunityEvent();
      else if (this.state.communityEvent?.path) await this.refreshCommunityEvent();

      const report = formatQuestReport(this.state);
      fs.mkdirSync('logs', { recursive: true });
      fs.appendFileSync(`logs/${dayjs().format('YYYY-MM-DD')}.txt`, `${JSON.stringify(report, null, 2)}\n`);
      if (!verify) {
        Logger.consoleLog(`${time()}${__('taskInfo')}`);
        console.table(report);
      }
      new Logger({ type: 'questInfo', data: report });
      return { ok: true };
    } catch (error) {
      logger.log(chalk.red('Error'));
      new Logger(error);
      return { ok: false, reason: 'request-failed', error };
    }
  }

  async loadTwitchBonus(): Promise<boolean> {
    if (!this.state.userProfileUrl) return false;
    const logger = new Logger(`${time()}${__('gettingTwitchTech')}`, false);
    try {
      this.state.additionalTwitchARP = await getTwitchBonus(this.awa.context, this.state.userProfileUrl);
      logger.log(chalk.green('OK'));
      return true;
    } catch (error) {
      logger.log(chalk.red('Error'));
      new Logger(error);
      return false;
    }
  }

  async refreshPersonalization(type: 'avatar' | 'border'): Promise<boolean> {
    const selection = await this.awa.personalization.getAvatarItems(type);
    return selection ? this.awa.personalization.saveAvatar(selection.userAvatarInfo) : false;
  }

  async claimQuest(questId: string): Promise<boolean> {
    const logger = new Logger(`${time()}${__('doingTask', chalk.yellow(questId))}`, false);
    try {
      const claimed = await claimQuestAward(this.awa.context, questId);
      logger.log(claimed ? chalk.green('OK') : chalk.red('Error'));
      return claimed;
    } catch (error) {
      logger.log(chalk.red('Error'));
      new Logger(error);
      return false;
    }
  }
  async visit(link: string): Promise<void> {
    const logger = new Logger(`${time()}${__('visitingPage', chalk.yellow(link))}`, false);
    try {
      await openPage(this.awa.context, link);
      logger.log(chalk.green('OK'));
    } catch (error) {
      logger.log(chalk.red('Error'));
      new Logger(error);
    }
  }
  async viewPost(postId: string): Promise<boolean> {
    await this.visit(`${this.awa.context.baseURL}/ucf/show/${postId}`);
    const logger = new Logger(`${time()}${__('sendingViewRecord', chalk.yellow(postId))}`, false);
    try {
      const viewed = await recordPostView(this.awa.context, postId);
      if (viewed) await sendTimeOnSiteTrack(this.awa.context, `${this.awa.context.baseURL}/ucf/show/${postId}`);
      logger.log(viewed ? chalk.green('OK') : chalk.red('Error'));
      return viewed;
    } catch (error) {
      logger.log(chalk.red('Error'));
      new Logger(error);
      return false;
    }
  }
  async viewPosts(postIds = this.state.posts): Promise<boolean> {
    for (const postId of postIds.slice(0, 3)) { await this.viewPost(postId); await sleep(random(1, 5)); }
    return postIds.length > 0;
  }
  async sharePosts(postIds = this.state.posts): Promise<boolean> {
    for (const postId of postIds.slice(0, 2)) {
      const logger = new Logger(`${time()}${__('sharingPost', chalk.yellow(postId))}`, false);
      try {
        const shared = await sharePost(this.awa.context, postId);
        logger.log(shared ? chalk.green('OK') : chalk.red('Error'));
      } catch (error) {
        logger.log(chalk.red('Error'));
        new Logger(error);
      }
      await sleep(random(1, 5));
    }
    return postIds.length > 0;
  }
  async replyPost(postId?: string): Promise<boolean> {
    const logger = new Logger(`${time()}${__('replyingPost', chalk.yellow(postId || 'Daily Quest'))}`, false);
    try {
      const replied = await replyPost(this.awa.context, postId);
      this.state.postReplied = replied;
      logger.log(replied ? chalk.green('OK') : chalk.red('Error'));
      return replied;
    } catch (error) {
      this.state.postReplied = false;
      logger.log(chalk.red('Error'));
      new Logger(error);
      return false;
    }
  }
  async viewNews(): Promise<void> {
    const newsId = '2162951';
    const html = await openPage(this.awa.context, `${this.awa.context.baseURL}/ucf/show/${newsId}/boards/awa-information/News/arp-6-0`);
    const $ = load(html);
    for (const script of $('script').toArray().flatMap((element) => ($(element).html()?.includes('/ajax/promo/view/') ? [$(element).html() || ''] : []))) {
      const id = script.match(/"\/ajax\/promo\/view\/([\d]+?)"/)?.[1];
      const token = script.match(/token:\s*?'(.+?)'/)?.[1];
      if (id && token) await recordPromotionView(this.awa.context, id, token);
    }
    await this.viewPost(newsId);
  }
  async sendTimeOnSite(): Promise<boolean> {
    const logger = new Logger(`${time()}${__('sendingOnlineTrack', chalk.yellow('AWA'))}`, false);
    try {
      const sent = await sendTimeOnSiteTrack(this.awa.context);
      if (sent) { this.state.trackError = 0; this.state.trackTimes++; } else this.state.trackError++;
      logger.log(sent ? chalk.green('OK') : chalk.red('Error'));
      return sent;
    } catch (error) {
      this.state.trackError++;
      logger.log(chalk.red('Error'));
      new Logger(error);
      return false;
    }
  }
  async monitor(signal?: AbortSignal): Promise<void> {
    while (!signal?.aborted) { await this.updateDailyQuests(); if (!await sleep(5 * 60, signal)) return; }
  }

  private async initializeCommunityEvent(): Promise<void> {
    const pathLogger = new Logger(`${time()}${__('gettingSteamCommunityEventPath')}`, false);
    const path = await this.awa.communityEvent.findPath().catch((error) => {
      pathLogger.log(chalk.red('Error'));
      new Logger(error);
      return null;
    });
    if (!path) return;
    pathLogger.log(chalk.green('OK'));
    const logger = new Logger(`${time()}${__('gettingSteamCommunityEvent')}`, false);
    const page = await this.awa.communityEvent.getEvent(path).catch((error) => {
      logger.log(chalk.red('Error'));
      new Logger(error);
      return null;
    });
    if (!page) return;
    if (page.closed || page.concluded || !page.gameId) {
      logger.log(chalk.yellow(page.closed ? 'Closed' : 'Finished'));
      return;
    }
    let joined = page.started;
    if (!joined) {
      const ownedLogger = new Logger(`${time()}${__('checkingOwnedGames', `[${page.gameName}](${page.gameId})`)}`, false);
      const owned = await this.awa.communityEvent.checkOwned(path);
      ownedLogger.log(owned ? chalk.green(__('owned')) : chalk.yellow(__('notOwned')));
      if (owned) {
        const joinLogger = new Logger(`${time()}${__('enteringSteamCommunityEvent')}`, false);
        joined = await this.awa.communityEvent.join(path);
        joinLogger.log(joined ? chalk.green('OK') : chalk.red('Error'));
      }
    }
    this.state.communityEvent = {
      path, gameId: page.gameId, status: joined ? __('joined') : __('notOwnedGame', `[${page.gameName}](${page.gameId})`),
      playedTime: `${page.playedMinutes}`, totalTime: `${page.totalMinutes}min`
    };
    logger.log(joined ? chalk.green('OK') : chalk.yellow(__('notOwned')));
  }
  private async refreshCommunityEvent(): Promise<void> {
    const event = this.state.communityEvent;
    if (!event?.path) return;
    const logger = new Logger(`${time()}${__('checkingSteamCommunityEventStatus')}`, false);
    const page = await this.awa.communityEvent.getEvent(event.path).catch((error) => {
      logger.log(chalk.red('Error'));
      new Logger(error);
      return null;
    });
    if (!page) return;
    event.playedTime = `${page.playedMinutes}`;
    event.totalTime = `${page.totalMinutes}min`;
    if (page.concluded || page.playedMinutes >= page.totalMinutes) {
      event.status = __('done');
      event.gameId = undefined;
    }
    logger.log(`${chalk.green('OK')}(${chalk.yellow(`${page.playedMinutes}/${page.totalMinutes}min`)})`);
  }
}
