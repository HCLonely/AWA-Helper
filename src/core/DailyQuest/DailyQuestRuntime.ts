/**
 * @file src/core/DailyQuest/DailyQuestRuntime.ts
 * @description 维护单次每日任务运行状态，并协调 AWA 页面访问、任务刷新和论坛操作。
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

  /**
   * 初始化 Daily Quest Runtime 实例。
   * @param options - 创建实例或执行操作所需的配置选项，类型为 `DailyQuestRuntimeOptions`。
   */
  constructor(options: DailyQuestRuntimeOptions) {
    this.awa = new AWAApiClient({ cookie: options.awaCookie, host: options.host, proxy: options.proxy, userAgent: options.userAgent });
    this.getStarted = !!options.getStarted;
    this.joinSteamCommunityEvent = !!options.joinSteamCommunityEvent;
  }

  /**
   * 获取 new Cookie。
   * @returns `string`，当前会话序列化后的 Cookie 字符串。
   */
  get newCookie(): string { return this.awa.newCookie; }

  /**
   * 初始化 init 相关数据。
   * @returns `Promise<DailyQuestRefreshResult>`，初始化完成后得到的每日任务刷新结果。
   */
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

  /**
   * 更新 update Daily Quests 相关数据。
   * @param verify - 用于决定是否重新验证任务状态，类型为 `boolean`。
   * @returns `Promise<DailyQuestRefreshResult>`，updateDailyQuests 操作完成后的结果。
   */
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
            itemLogger.log(completed.ok ? chalk.green('OK') : chalk.red(`Error (${completed.state})`));
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

  /**
   * 加载 load Twitch Bonus 相关数据。
   * @returns `Promise<boolean>`，表示 loadTwitchBonus 检查是否通过。
   */
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

  /**
   * 更新 refresh Personalization 相关数据。
   * @param type - 用于选择处理分支的类型，类型为 `"avatar" | "border"`。
   * @returns `Promise<boolean>`，表示 refreshPersonalization 检查是否通过。
   */
  async refreshPersonalization(type: 'avatar' | 'border'): Promise<boolean> {
    const selection = await this.awa.personalization.getAvatarItems(type);
    return selection.found ? (await this.awa.personalization.saveAvatar(selection.value.userAvatarInfo)).ok : false;
  }

  /**
   * 完成 claim Quest 相关数据。
   * @param questId - 目标资源的唯一标识，类型为 `string`。
   * @returns `Promise<boolean>`，表示 claimQuest 检查是否通过。
   */
  async claimQuest(questId: string): Promise<boolean> {
    const logger = new Logger(`${time()}${__('doingTask', chalk.yellow(questId))}`, false);
    try {
      const claimed = await claimQuestAward(this.awa.context, questId);
      logger.log(claimed.ok ? chalk.green('OK') : chalk.red(`Error (${claimed.state})`));
      return claimed.ok;
    } catch (error) {
      logger.log(chalk.red('Error'));
      new Logger(error);
      return false;
    }
  }
  /**
   * 处理 visit 相关逻辑。
   * @param link - 需要访问或提交的目标页面链接，类型为 `string`。
   * @returns `Promise<void>`，异步操作完成后兑现，不携带结果值。
   */
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
  /**
   * 处理 view Post 相关逻辑。
   * @param postId - 目标资源的唯一标识，类型为 `string`。
   * @returns `Promise<boolean>`，表示 viewPost 检查是否通过。
   */
  async viewPost(postId: string): Promise<boolean> {
    await this.visit(`${this.awa.context.baseURL}/ucf/show/${postId}`);
    const logger = new Logger(`${time()}${__('sendingViewRecord', chalk.yellow(postId))}`, false);
    try {
      const viewed = await recordPostView(this.awa.context, postId);
      if (viewed.ok) await sendTimeOnSiteTrack(this.awa.context, `${this.awa.context.baseURL}/ucf/show/${postId}`);
      logger.log(viewed.ok ? chalk.green('OK') : chalk.red(`Error (${viewed.state})`));
      return viewed.ok;
    } catch (error) {
      logger.log(chalk.red('Error'));
      new Logger(error);
      return false;
    }
  }
  /**
   * 处理 view Posts 相关逻辑。
   * @param postIds - 需要查看或分享的论坛帖子标识列表，类型为 `string[]`。
   * @returns `Promise<boolean>`，表示 viewPosts 检查是否通过。
   */
  async viewPosts(postIds = this.state.posts): Promise<boolean> {
    for (const postId of postIds.slice(0, 3)) { await this.viewPost(postId); await sleep(random(1, 5)); }
    return postIds.length > 0;
  }
  /**
   * 处理 share Posts 相关逻辑。
   * @param postIds - 需要查看或分享的论坛帖子标识列表，类型为 `string[]`。
   * @returns `Promise<boolean>`，表示 sharePosts 检查是否通过。
   */
  async sharePosts(postIds = this.state.posts): Promise<boolean> {
    for (const postId of postIds.slice(0, 2)) {
      const logger = new Logger(`${time()}${__('sharingPost', chalk.yellow(postId))}`, false);
      try {
        const shared = await sharePost(this.awa.context, postId);
        logger.log(shared.ok ? chalk.green('OK') : chalk.red(`Error (${shared.state})`));
      } catch (error) {
        logger.log(chalk.red('Error'));
        new Logger(error);
      }
      await sleep(random(1, 5));
    }
    return postIds.length > 0;
  }
  /**
   * 处理 reply Post 相关逻辑。
   * @param postId - 目标资源的唯一标识，类型为 `string | undefined`。
   * @returns `Promise<boolean>`，表示 replyPost 检查是否通过。
   */
  async replyPost(postId?: string): Promise<boolean> {
    const logger = new Logger(`${time()}${__('replyingPost', chalk.yellow(postId || 'Daily Quest'))}`, false);
    try {
      const replied = await replyPost(this.awa.context, postId);
      this.state.postReplied = replied.ok;
      logger.log(replied.ok ? chalk.green('OK') : chalk.red(`Error (${replied.state})`));
      return replied.ok;
    } catch (error) {
      this.state.postReplied = false;
      logger.log(chalk.red('Error'));
      new Logger(error);
      return false;
    }
  }
  /**
   * 处理 view News 相关逻辑。
   * @returns `Promise<void>`，异步操作完成后兑现，不携带结果值。
   */
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
  /**
   * 发送 send Time On Site 相关数据。
   * @returns `Promise<boolean>`，表示 sendTimeOnSite 检查是否通过。
   */
  async sendTimeOnSite(): Promise<boolean> {
    const logger = new Logger(`${time()}${__('sendingOnlineTrack', chalk.yellow('AWA'))}`, false);
    try {
      const sent = await sendTimeOnSiteTrack(this.awa.context);
      if (sent.ok) { this.state.trackError = 0; this.state.trackTimes++; } else this.state.trackError++;
      logger.log(sent.ok ? chalk.green('OK') : chalk.red(`Error (${sent.state})`));
      return sent.ok;
    } catch (error) {
      this.state.trackError++;
      logger.log(chalk.red('Error'));
      new Logger(error);
      return false;
    }
  }
  /**
   * 处理 monitor 相关逻辑。
   * @param signal - 用于取消当前异步操作的中止信号，类型为 `AbortSignal | undefined`。
   * @returns `Promise<void>`，异步操作完成后兑现，不携带结果值。
   */
  async monitor(signal?: AbortSignal): Promise<void> {
    while (!signal?.aborted) { await this.updateDailyQuests(); if (!await sleep(5 * 60, signal)) return; }
  }

  /**
   * 初始化 initialize Community Event 相关数据。
   * @returns `Promise<void>`，异步操作完成后兑现，不携带结果值。
   */
  private async initializeCommunityEvent(): Promise<void> {
    const pathLogger = new Logger(`${time()}${__('gettingSteamCommunityEventPath')}`, false);
    const pathLookup = await this.awa.communityEvent.findPath().catch((error) => {
      pathLogger.log(chalk.red('Error'));
      new Logger(error);
      return null;
    });
    if (!pathLookup?.found) return;
    const path = pathLookup.value;
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
      ownedLogger.log(owned.ok ? chalk.green(__('owned')) : chalk.yellow(__('notOwned')));
      if (owned.ok) {
        const joinLogger = new Logger(`${time()}${__('enteringSteamCommunityEvent')}`, false);
        joined = (await this.awa.communityEvent.join(path)).ok;
        joinLogger.log(joined ? chalk.green('OK') : chalk.red('Error'));
      }
    }
    this.state.communityEvent = {
      path, gameId: page.gameId, status: joined ? __('joined') : __('notOwnedGame', `[${page.gameName}](${page.gameId})`),
      playedTime: `${page.playedMinutes}`, totalTime: `${page.totalMinutes}min`
    };
    logger.log(joined ? chalk.green('OK') : chalk.yellow(__('notOwned')));
  }
  /**
   * 更新 refresh Community Event 相关数据。
   * @returns `Promise<void>`，异步操作完成后兑现，不携带结果值。
   */
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
