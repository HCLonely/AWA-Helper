/**
 * @file src/core/DailyQuest/DailyQuestRuntime.ts
 * @description 维护单次每日任务运行状态，并协调 AWA 页面访问、任务刷新和论坛操作。
 */
/* global __ */
import { load } from 'cheerio';
import { readCommunityEventData, saveCommunityEventData } from '../../client/AWA/communityEventStore';
import { fetchCommunityEventMetadata, isCommunityEventActive, matchCommunityEventMetadata, parseCommunityEventMetadataList, type CommunityEventMetadata } from '../../client/AWA/communityEventMetadata';
import chalk from 'chalk';
import { AWAApiClient } from '../../client/AWA/AWAApiClient';
import {
  claimQuestAward, completeGetStartedItem, getControlCenter, getTwitchBonus, openPage, recordPostView,
  recordPromotionView, refreshSession, replyPost, sendTimeOnSiteTrack, sharePost
} from '../../client/AWA/APIs';
import { parseVerifiedControlCenter as parseControlCenter } from '../../client/AWA/parsers/verifiedControlCenter';
import { Logger, random, sleep, time } from '../../tools';
import { DailyQuestState, type SteamCommunityEventState } from './DailyQuestState';
import { formatQuestReport } from './QuestReporter';
import { AWAError } from '../../client/AWA/AWAError';
import { writeFileLog } from '../../tools/logging';

export interface DailyQuestRuntimeOptions {
  awaCookie: string;
  host: string;
  proxy?: proxy;
  userAgent?: string;
  getStarted?: boolean;
  joinSteamCommunityEvent?: boolean;
  communityEventFile: string;
  logRequests?: boolean;
}

export type DailyQuestRefreshResult =
  | {
    ok: true
  }
  | {
    ok: false;
    reason: 'network-rejected' | 'session-expired' | 'request-failed';
    error?: unknown
  };

export class DailyQuestRuntime {
  readonly awa: AWAApiClient;
  readonly state = new DailyQuestState();
  private readonly getStarted: boolean;
  private readonly joinSteamCommunityEvent: boolean;
  private readonly communityEventFile: string;

  /**
   * 初始化 DailyQuestRuntime 实例。
   * @param options - 创建实例或执行操作所需的配置选项，类型为 `DailyQuestRuntimeOptions`。
   */
  constructor(options: DailyQuestRuntimeOptions) {
    this.awa = new AWAApiClient({
      cookie: options.awaCookie,
      host: options.host,
      proxy: options.proxy,
      userAgent: options.userAgent,
      logRequests: options.logRequests
    });
    this.getStarted = !!options.getStarted;
    this.joinSteamCommunityEvent = !!options.joinSteamCommunityEvent;
    this.communityEventFile = options.communityEventFile;
  }

  /**
   * 获取 new Cookie。
   * @returns `string`，当前会话序列化后的 Cookie 字符串。
   */
  get newCookie(): string {
    return this.awa.newCookie;
  }

  /**
   * 初始化任务状态。
   * @returns `Promise<DailyQuestRefreshResult>`，初始化完成后得到的每日任务刷新结果。
   */
  async init(): Promise<DailyQuestRefreshResult> {
    const logger = new Logger(`${time()}${__('updatingCookie', chalk.yellow('AWA Cookie'))}...`, false);
    try {
      await refreshSession(this.awa.context);
      logger.log(chalk.green(__('logStatusOk')));
      return this.updateDailyQuests(true);
    } catch (error) {
      logger.log(chalk.red(__('logStatusError')));
      new Logger(error);
      if (error instanceof AWAError && error.statusCode === 610) {
        return {
          ok: false,
          reason: 'network-rejected',
          error
        };
      }
      if (error instanceof AWAError && error.statusCode === 602) {
        return {
          ok: false,
          reason: 'session-expired',
          error
        };
      }
      return {
        ok: false,
        reason: 'request-failed',
        error
      };
    }
  }

  /**
   * 更新每日任务状态。
   * @param verify - 用于决定是否重新验证任务状态，类型为 `boolean`。
   * @returns `Promise<DailyQuestRefreshResult>`，updateDailyQuests 操作完成后的结果。
   */
  async updateDailyQuests(verify = false): Promise<DailyQuestRefreshResult> {
    const logger = new Logger(time() + (verify ? __('verifyingToken', chalk.yellow('AWA Token')) : __('gettingTaskInfo')), false);
    try {
      const html = await getControlCenter(this.awa.context);
      if (html.toLowerCase().includes('we have detected an issue with your network')) {
        logger.log(chalk.red(__('ipBanned')));
        return {
          ok: false,
          reason: 'network-rejected'
        };
      }
      const page = load(html);
      if (page('a.nav-link-login').length) {
        logger.log(chalk.red(__('tokenExpired')));
        return {
          ok: false,
          reason: 'session-expired'
        };
      }
      const snapshot = parseControlCenter(html, this.awa.context.baseURL, page);
      this.state.questInfo = snapshot.questInfo;
      this.state.userProfileUrl = snapshot.userProfileUrl || this.state.userProfileUrl;
      this.state.dailyQuestLink = snapshot.dailyQuestLink;
      this.state.battlePassUrl = snapshot.battlePassUrl;
      this.state.dailyArp = snapshot.dailyArp;
      this.state.taskType = snapshot.taskType;
      this.state.signArp = snapshot.signArp;
      this.state.promotionalCalendarInfo = snapshot.promotionalCalendarInfo;
      this.state.posts = snapshot.posts;
      logger.log(chalk.green(__('logStatusOk')));

      if (verify && snapshot.signArp.daily) {
        new Logger(`${time()}${__('dailySign', chalk.green(snapshot.signArp.daily))}`);
      }
      if (verify && snapshot.signArp.monthly) {
        new Logger(`${time()}${__('monthlySign', chalk.green(snapshot.signArp.monthly))}`);
      }
      if (verify && snapshot.promotionalCalendarInfo?.some(({
        finished
      }) => !finished)) {
        new Logger(`${time()}${chalk.green(__('promotionalAlert'))}`);
      }

      if (verify && this.getStarted) {
        for (const item of snapshot.getStartedItems) {
          const itemLogger = new Logger(`${time()}${__('doingGetStartedQuest', chalk.yellow(item.name))}`, false);
          try {
            const completed = await completeGetStartedItem(this.awa.context, item.link);
            itemLogger.log(completed.ok ? chalk.green(__('logStatusOk')) : chalk.red(`${__('logStatusError')} (${completed.state})`));
          } catch (error) {
            itemLogger.log(chalk.red(__('logStatusError')));
            new Logger(error);
          }
        }
      }
      if (verify && this.joinSteamCommunityEvent) {
        await this.initializeCommunityEvent(html);
      } else if (this.joinSteamCommunityEvent) {
        await this.refreshCommunityEvent(html);
      }

      const report = formatQuestReport(this.state);
      writeFileLog('dailyQuest', JSON.stringify(report, null, 2));
      if (!verify) {
        Logger.consoleLog(`${time()}${__('taskInfo')}`);
        console.table(report);
      }
      new Logger({
        type: 'questInfo',
        data: report
      });
      return {
        ok: true
      };
    } catch (error) {
      logger.log(chalk.red(__('logStatusError')));
      new Logger(error);
      return {
        ok: false,
        reason: 'request-failed',
        error
      };
    }
  }

  /**
   * 加载 Twitch 加成。
   * @returns `Promise<boolean>`，表示 loadTwitchBonus 检查是否通过。
   */
  async loadTwitchBonus(): Promise<boolean> {
    if (!this.state.userProfileUrl) {
      return false;
    }
    const logger = new Logger(`${time()}${__('gettingTwitchTech')}`, false);
    try {
      this.state.additionalTwitchARP = await getTwitchBonus(this.awa.context, this.state.userProfileUrl);
      logger.log(chalk.green(__('logStatusOk')));
      return true;
    } catch (error) {
      logger.log(chalk.red(__('logStatusError')));
      new Logger(error);
      return false;
    }
  }

  /**
   * 刷新个性化配置。
   * @param type - 用于选择处理分支的类型，类型为 `"avatar" | "border"`。
   * @param signal - 用于停止后续账户操作的中止信号。
   * @returns `Promise<boolean>`，表示 refreshPersonalization 检查是否通过。
   */
  async refreshPersonalization(type: 'avatar' | 'border', signal?: AbortSignal): Promise<boolean> {
    if (signal?.aborted) {
      return false;
    }
    const logger = new Logger(`${time()}${__('dailyQuestRefreshingPersonalization', __(`personalizationType_${type}`))}`, false);
    const selection = await this.awa.personalization.getAvatarItems(type);
    const success = selection.found && !signal?.aborted ? (await this.awa.personalization.saveAvatar(selection.value.userAvatarInfo)).ok : false;
    logger.log(success ? chalk.green(__('logStatusOk')) : chalk.red(__('logStatusError')));
    return success;
  }

  /**
   * 领取任务奖励。
   * @param questId - 目标资源的唯一标识，类型为 `string`。
   * @returns `Promise<boolean>`，表示 claimQuest 检查是否通过。
   */
  async claimQuest(questId: string): Promise<boolean> {
    const logger = new Logger(`${time()}${__('doingTask', chalk.yellow(questId))}`, false);
    try {
      const claimed = await claimQuestAward(this.awa.context, questId);
      logger.log(claimed.ok ? chalk.green(__('logStatusOk')) : chalk.red(`${__('logStatusError')} (${claimed.state})`));
      return claimed.ok;
    } catch (error) {
      logger.log(chalk.red(__('logStatusError')));
      new Logger(error);
      return false;
    }
  }
  /**
   * 访问目标页面。
   * @param link - 需要访问或提交的目标页面链接，类型为 `string`。
   * @param signal - 用于停止后续账户操作的中止信号。
   * @returns `Promise<void>`，异步操作完成后兑现，不携带结果值。
   */
  async visit(link: string, signal?: AbortSignal): Promise<void> {
    if (signal?.aborted) {
      return;
    }
    const logger = new Logger(`${time()}${__('visitingPage', chalk.yellow(link))}`, false);
    try {
      await openPage(this.awa.context, link);
      logger.log(chalk.green(__('logStatusOk')));
    } catch (error) {
      logger.log(chalk.red(__('logStatusError')));
      new Logger(error);
    }
  }
  /**
   * 浏览帖子。
   * @param postId - 目标资源的唯一标识，类型为 `string`。
   * @param signal - 用于停止后续账户操作的中止信号。
   * @returns `Promise<boolean>`，表示 viewPost 检查是否通过。
   */
  async viewPost(postId: string, signal?: AbortSignal): Promise<boolean> {
    await this.visit(`${this.awa.context.baseURL}/ucf/show/${postId}`, signal);
    if (signal?.aborted) {
      return false;
    }
    const logger = new Logger(`${time()}${__('sendingViewRecord', chalk.yellow(postId))}`, false);
    try {
      const viewed = await recordPostView(this.awa.context, postId);
      if (viewed.ok && !signal?.aborted) {
        await sendTimeOnSiteTrack(this.awa.context, `${this.awa.context.baseURL}/ucf/show/${postId}`);
      }
      logger.log(viewed.ok ? chalk.green(__('logStatusOk')) : chalk.red(`${__('logStatusError')} (${viewed.state})`));
      return viewed.ok;
    } catch (error) {
      logger.log(chalk.red(__('logStatusError')));
      new Logger(error);
      return false;
    }
  }
  /**
   * 批量浏览帖子。
   * @param postIds - 需要查看或分享的论坛帖子标识列表，类型为 `string[]`。
   * @param signal - 用于停止后续账户操作的中止信号。
   * @returns `Promise<boolean>`，表示 viewPosts 检查是否通过。
   */
  async viewPosts(postIds = this.state.posts, signal?: AbortSignal): Promise<boolean> {
    new Logger(`${time()}${__('dailyQuestViewingPosts', String(postIds.length))}`);
    for (const postId of postIds.slice(0, 3)) {
      if (signal?.aborted) {
        return false;
      }
      await this.viewPost(postId, signal);
      if (!await sleep(random(1, 5), signal)) {
        return false;
      }
    }
    return postIds.length > 0;
  }
  /**
   * 批量分享帖子。
   * @param postIds - 需要查看或分享的论坛帖子标识列表，类型为 `string[]`。
   * @param signal - 用于停止后续账户操作的中止信号。
   * @returns `Promise<boolean>`，表示 sharePosts 检查是否通过。
   */
  async sharePosts(postIds = this.state.posts, signal?: AbortSignal): Promise<boolean> {
    new Logger(`${time()}${__('dailyQuestSharingPosts', String(postIds.length))}`);
    for (const postId of postIds.slice(0, 2)) {
      if (signal?.aborted) {
        return false;
      }
      const logger = new Logger(`${time()}${__('sharingPost', chalk.yellow(postId))}`, false);
      try {
        const shared = await sharePost(this.awa.context, postId);
        logger.log(shared.ok ? chalk.green(__('logStatusOk')) : chalk.red(`${__('logStatusError')} (${shared.state})`));
      } catch (error) {
        logger.log(chalk.red(__('logStatusError')));
        new Logger(error);
      }
      if (!await sleep(random(1, 5), signal)) {
        return false;
      }
    }
    return postIds.length > 0;
  }
  /**
   * 回复帖子。
   * @param postId - 目标资源的唯一标识，类型为 `string | undefined`。
   * @param signal - 用于停止后续账户操作的中止信号。
   * @returns `Promise<boolean>`，表示 replyPost 检查是否通过。
   */
  async replyPost(postId?: string, signal?: AbortSignal): Promise<boolean> {
    if (signal?.aborted) {
      return false;
    }
    const logger = new Logger(`${time()}${__('replyingPost', chalk.yellow(postId || 'Daily Quest'))}`, false);
    try {
      const replied = await replyPost(this.awa.context, postId);
      this.state.postReplied = replied.ok;
      logger.log(replied.ok ? chalk.green(__('logStatusOk')) : chalk.red(`${__('logStatusError')} (${replied.state})`));
      return replied.ok;
    } catch (error) {
      this.state.postReplied = false;
      logger.log(chalk.red(__('logStatusError')));
      new Logger(error);
      return false;
    }
  }
  /**
   * 浏览新闻。
   * @param signal - 用于停止后续账户操作的中止信号。
   * @returns `Promise<void>`，异步操作完成后兑现，不携带结果值。
   */
  async viewNews(signal?: AbortSignal): Promise<void> {
    if (signal?.aborted) {
      return;
    }
    const newsId = '2162951';
    new Logger(`${time()}${__('dailyQuestProcessingNews', newsId)}`);
    const html = await openPage(this.awa.context, `${this.awa.context.baseURL}/ucf/show/${newsId}/boards/awa-information/News/arp-6-0`);
    if (signal?.aborted) {
      return;
    }
    const $ = load(html);
    for (const script of $('script').toArray().flatMap((element) => ($(element).html()?.includes('/ajax/promo/view/') ? [$(element).html() || ''] : []))) {
      if (signal?.aborted) {
        return;
      }
      const id = script.match(/"\/ajax\/promo\/view\/([\d]+?)"/)?.[1];
      const token = script.match(/token:\s*?'(.+?)'/)?.[1];
      if (id && token) {
        await recordPromotionView(this.awa.context, id, token);
      }
    }
    await this.viewPost(newsId, signal);
    if (signal?.aborted) {
      return;
    }
    new Logger(`${time()}${__('dailyQuestNewsCompleted')}`);
  }
  /**
   * 上报在线时长。
   * @returns `Promise<boolean>`，表示 sendTimeOnSite 检查是否通过。
   */
  async sendTimeOnSite(): Promise<boolean> {
    const logger = new Logger(`${time()}${__('sendingOnlineTrack', chalk.yellow('AWA'))}`, false);
    try {
      const sent = await sendTimeOnSiteTrack(this.awa.context);
      if (sent.ok) {
        this.state.trackError = 0; this.state.trackTimes++;
      } else {
        this.state.trackError++;
      }
      logger.log(sent.ok ? chalk.green(__('logStatusOk')) : chalk.red(`${__('logStatusError')} (${sent.state})`));
      return sent.ok;
    } catch (error) {
      this.state.trackError++;
      logger.log(chalk.red(__('logStatusError')));
      new Logger(error);
      return false;
    }
  }
  /**
   * 监控任务进度。
   * @param signal - 用于取消当前异步操作的中止信号，类型为 `AbortSignal | undefined`。
   * @returns `Promise<void>`，异步操作完成后兑现，不携带结果值。
   */
  async monitor(signal?: AbortSignal): Promise<void> {
    new Logger(`${time()}${__('dailyQuestMonitorStarted', '5')}`);
    while (!signal?.aborted) {
      await this.updateDailyQuests();
      if (!await sleep(5 * 60, signal)) {
        break;
      }
    }
    new Logger(`${time()}${__('dailyQuestMonitorStopped')}`);
  }

  /**
   * 初始化社区活动。
   * @returns `Promise<void>`，异步操作完成后兑现，不携带结果值。
   */
  private async initializeCommunityEvent(html?: string): Promise<void> {
    if (!this.joinSteamCommunityEvent) {
      return;
    }
    const previous = this.state.communityEvents;
    // 获取页面失败时也不能继续使用过期或已删除的游戏配置。
    try {
      const valid = parseCommunityEventMetadataList(readCommunityEventData(this.communityEventFile));
      previous.forEach((event) => {
        if (!valid.some((game) => game.gameId === event.gameId && (!game.eventPath || game.eventPath === event.path))) {
          event.gameId = undefined;
        }
      });
    } catch {
      previous.forEach((event) => {
        event.gameId = undefined;
      });
    }
    const listings = await this.awa.communityEvent.listEvents(html).catch((error) => {
      new Logger(error);
      return null;
    });
    if (!listings) {
      return;
    }
    if (!listings.length) {
      this.state.communityEvents = [];
      return;
    }
    const games = await this.resolveCommunityEventMetadata();
    const events: SteamCommunityEventState[] = [];
    for (const listing of listings) {
      const logger = new Logger(`${time()}${__('gettingSteamCommunityEvent')} [${listing.title}]`, false);
      try {
        const page = await this.awa.communityEvent.getEvent(listing.path);
        const metadata = matchCommunityEventMetadata(games, listing, page);
        const state: SteamCommunityEventState = {
          path: listing.path,
          gameName: metadata?.gameName || listing.title,
          status: __('logStatusClosed'),
          playedTime: `${page.playedMinutes}`,
          totalTime: `${page.totalMinutes}min`
        };
        events.push(state);
        if (page.concluded || page.closed) {
          state.status = __('logStatusFinished');
        } else if (page.totalMinutes > 0 && page.playedMinutes >= page.totalMinutes) {
          state.status = __('done');
        } else if (isCommunityEventActive(page)) {
          if (!metadata) {
            state.status = __('communityEventDataRequired');
          } else {
            let {
              joined
            } = page;
            if (!joined && (page.owned || (await this.awa.communityEvent.checkOwned(listing.path)).ok)) {
              joined = (await this.awa.communityEvent.join(listing.path)).ok;
            }
            state.status = joined ? __('joined') : __('notOwnedGame', `[${metadata.gameName || metadata.gameId}](${metadata.gameId})`);
            // 未加入、已结束、已完成或缺少配置的活动都不能交给 ASF 挂时长。
            state.gameId = joined ? metadata.gameId : undefined;
          }
        }
        logger.log(`${chalk.green(__('logStatusOk'))} (${page.playedMinutes}/${page.totalMinutes}min)`);
      } catch (error) {
        logger.log(chalk.red(__('logStatusError')));
        new Logger(error);
        const failed = events.find((event) => event.path === listing.path);
        if (failed) {
          failed.status = __('logStatusError');
          failed.gameId = undefined;
        }
        if (!events.some((event) => event.path === listing.path)) {
          const old = previous.find((event) => event.path === listing.path);
          if (old) {
            events.push({
              ...old,
              gameId: games.some((game) => game.gameId === old.gameId && (!game.eventPath || game.eventPath === old.path)) ? old.gameId : undefined
            });
          }
        }
      }
    }
    this.state.communityEvents = events;
  }

  /** 保留本月有效的手工配置，远程数据只补充缺失或过期的游戏。 */
  private async resolveCommunityEventMetadata(): Promise<CommunityEventMetadata[]> {
    let valid: CommunityEventMetadata[] = [];
    try {
      const saved = readCommunityEventData(this.communityEventFile);
      valid = parseCommunityEventMetadataList(saved);
      if (valid.length && valid.length === saved.games.length) {
        return valid;
      }
      const remote = await fetchCommunityEventMetadata(saved.sourceUrl);
      const latest = readCommunityEventData(this.communityEventFile);
      if (JSON.stringify(latest) !== JSON.stringify(saved)) {
        return parseCommunityEventMetadataList(latest);
      }
      const merged = [...valid, ...remote.filter((game) => !valid.some((entry) => entry.gameId === game.gameId || (game.eventPath && entry.eventPath === game.eventPath)))];
      return saveCommunityEventData(this.communityEventFile, saved.sourceUrl, merged).games;
    } catch (error) {
      new Logger(error instanceof Error ? __(error.message) : String(error));
      return valid;
    }
  }

  private async refreshCommunityEvent(html?: string): Promise<void> {
    await this.initializeCommunityEvent(html);
  }
}
