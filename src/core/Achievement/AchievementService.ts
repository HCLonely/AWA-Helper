/**
 * @file src/core/Achievement/AchievementService.ts
 * @description 编排头像、边框和 Twitch 时长等成就任务，并持久化成就操作历史。
 */

/* global __, proxy */
import { Achievement, ActionHistory, Id, userAvatarInfo } from '../../types/achievement';
import { AWAApiClient } from '../../client/AWA/AWAApiClient';
import { sleep, Logger, time } from '../../tools';
import { TwitchClient } from '../../client/Twitch/TwitchClient';
import type { TwitchChannelTrackingInfo } from '../../client/Twitch/types';
import chalk from 'chalk';
import * as fs from 'fs';
import { atomicWriteFileSync } from '../../tools/config/YamlConfig';

export class AchievementService {
  awa: AWAApiClient;
  twitch!: TwitchClient | null;
  twitchCookie?: string;
  availableAchievements: Array<string> = [
    'Use 25 different borders',
    'Change your border once a day for a week',
    'Change your border once a month for a year',
    'Change your avatar items every day for a week',
    'Change your avatar once a month for 1 year',
    'Watch 1000 Hours of Twitch.tv on Hive channels',
    'Watch 1000 Hours of Twitch.tv on Nexus channels'
  ];
  Achievements!: Array<Achievement>;
  achievement2action: {
    [key in typeof this.availableAchievements[number]]: () => Promise<void>;
  } = {
      /**
       * 处理当前映射项的回调逻辑。
       * @returns `Promise<void>`，异步操作完成后兑现，不携带结果值。
       */
      'Use 25 different borders': () => this.border25(),
      /**
       * 处理当前映射项的回调逻辑。
       * @returns `Promise<void>`，异步操作完成后兑现，不携带结果值。
       */
      'Change your border once a day for a week': () => this.onceADayForAWeek('border'),
      /**
       * 处理当前映射项的回调逻辑。
       * @returns `Promise<void>`，异步操作完成后兑现，不携带结果值。
       */
      'Change your border once a month for a year': () => this.onceAMonthForAYear('border'),
      /**
       * 处理当前映射项的回调逻辑。
       * @returns `Promise<void>`，异步操作完成后兑现，不携带结果值。
       */
      'Change your avatar items every day for a week': () => this.onceADayForAWeek('avatar'),
      /**
       * 处理当前映射项的回调逻辑。
       * @returns `Promise<void>`，异步操作完成后兑现，不携带结果值。
       */
      'Change your avatar once a month for 1 year': () => this.onceAMonthForAYear('avatar'),
      /**
       * 处理当前映射项的回调逻辑。
       * @returns `Promise<void>`，异步操作完成后兑现，不携带结果值。
       */
      'Watch 1000 Hours of Twitch.tv on Hive channels': () => this.addWatchTwitch('hive'),
      /**
       * 处理当前映射项的回调逻辑。
       * @returns `Promise<void>`，异步操作完成后兑现，不携带结果值。
       */
      'Watch 1000 Hours of Twitch.tv on Nexus channels': () => this.addWatchTwitch('nexus')
    };
  incompletedAchievements: Array<string> = [];
  userAvatarInfo: userAvatarInfo | null = null;
  actionHistoryPath: string = 'data/achievement/action-history.json';
  watchTwitchStatus: {
    running: boolean,
    type: Set<'hive' | 'nexus'>
  } = {
      running: false,
      type: new Set()
    };

  /**
   * 初始化 Achievement Service 实例。
   * @param options - 创建实例或执行操作所需的配置选项，类型为 `{ awaCookie: string; proxy?: proxy; awaHost: string; twitchCookie?: string; userAgent?: string; }`。
   */
  constructor({ awaCookie, proxy, awaHost, twitchCookie, userAgent }: { awaCookie: string; proxy?: proxy; awaHost: string; twitchCookie?: string; userAgent?: string }) {
    this.awa = new AWAApiClient({
      cookie: awaCookie,
      proxy,
      host: awaHost,
      userAgent
    });
    if (twitchCookie) {
      this.twitchCookie = twitchCookie;
    }
  }
  /**
   * 获取 read Action History 相关数据。
   * @returns `ActionHistory`，readActionHistory 获取到的数据。
   */
  private readActionHistory(): ActionHistory {
    const defaultHistory: ActionHistory = { border: { date: '', used: [] }, avatar: { date: '', used: [] } };
    try {
      const parsed = JSON.parse(fs.readFileSync(this.actionHistoryPath, 'utf8')) as Partial<ActionHistory>;
      return {
        border: {
          date: typeof parsed.border?.date === 'string' ? parsed.border.date : '',
          used: Array.isArray(parsed.border?.used) ? parsed.border.used.filter((id): id is string => typeof id === 'string') : []
        },
        avatar: {
          date: typeof parsed.avatar?.date === 'string' ? parsed.avatar.date : '',
          used: Array.isArray(parsed.avatar?.used) ? parsed.avatar.used.filter((id): id is string => typeof id === 'string') : []
        }
      };
    } catch (_error) {
      return defaultHistory;
    }
  }
  /**
   * 保存 write Action History 相关数据。
   * @param actionHistory - 记录头像或边框更换情况的操作历史，类型为 `ActionHistory`。
   * @returns `void`，该函数仅执行副作用，不返回值。
   */
  private writeActionHistory(actionHistory: ActionHistory): void {
    atomicWriteFileSync(this.actionHistoryPath, JSON.stringify(actionHistory));
  }
  /**
   * 处理 local Date 相关逻辑。
   * @param now - 计算或比较时使用的时间，类型为 `Date`。
   * @returns `string`，localDate 获取或生成的文本内容。
   */
  private localDate(now: Date): string {
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  /**
   * 初始化 init 相关数据。
   * @returns `Promise<void>`，异步操作完成后兑现，不携带结果值。
   */
  async init(): Promise<void> {
    await this.awa.session.refresh();
    await this.awa.session.verify();
    this.Achievements = await this.awa.achievement.getAll();
    fs.mkdirSync('data/achievement', { recursive: true });
    if (!fs.existsSync(this.actionHistoryPath)) {
      atomicWriteFileSync(this.actionHistoryPath, JSON.stringify({ border: { date: '', used: [] }, avatar: { date: '', used: [] } }));
    }
  }
  /**
   * 执行 run 相关数据。
   * @param signal - 用于取消当前异步操作的中止信号，类型为 `AbortSignal | undefined`。
   * @returns `Promise<void>`，异步操作完成后兑现，不携带结果值。
   */
  async run(signal?: AbortSignal): Promise<void> {
    new Logger(`${time()}${__('matching', chalk.yellow('Achievements'))}`);
    // addLog('开始匹配可操作的成就', TaskStatus.RUNNING);

    this.userAvatarInfo = null;
    for (const availableAchievement of this.availableAchievements) {
      const achievement = this.Achievements.find((achievement) => achievement.description === availableAchievement && !achievement.completed);
      if (achievement) {
        this.incompletedAchievements.push(availableAchievement);
        new Logger(`${time()}${__('doingAchievement', chalk.yellow(availableAchievement))}`);
        if (signal?.aborted) return;
        await this.achievement2action[availableAchievement]();
        new Logger(`${time()}${__('doneAchievement', chalk.yellow(availableAchievement))}`);
      }
    }
    await this.watchTwitch(signal);
    new Logger(`${time()}${__('doneMatch', chalk.yellow('Achievements'))}`);
  }

  /**
   * 处理 border25 相关逻辑。
   * @returns `Promise<void>`，异步操作完成后兑现，不携带结果值。
   */
  async border25(): Promise<void> {
    const borderLookup = await this.awa.personalization.getAvatarItems('border');
    const { userAvatarInfo: UAI, ids: borders } = borderLookup.found ? borderLookup.value : {};
    const existingAvatarInfo = this.userAvatarInfo || UAI;
    if (!borders || !existingAvatarInfo) {
      return;
    }
    const userAvatarInfo = { ...existingAvatarInfo };
    const borderIds = borders.map((border:Id) => border.id);
    if (borderIds.length < 25) {
      new Logger(`${time()}${__('notEnoughBorders', chalk.yellow('25'))}`);
      return;
    }
    new Logger(`${time()}${__('foundEnoughBorders', chalk.green('25'))}`);
    // addLog('找到足够的边框(25个)', TaskStatus.SUCCESS);

    for (let i = 0; i < 25; i++) {
      userAvatarInfo.border = borderIds[i];
      if (!(await this.awa.personalization.saveAvatar(userAvatarInfo)).ok) return;
      this.userAvatarInfo = userAvatarInfo;
      // new Logger(`${time()}${__('changeBorder', chalk.yellow(borderId))}`, false);
      await sleep(5);
    }
    new Logger(`${time()}${chalk.green(__('doneBorder25'))}`);
  }

  /**
   * 处理 once ADay For AWeek 相关逻辑。
   * @param type - 用于选择处理分支的类型，类型为 `"avatar" | "border"`。
   * @returns `Promise<void>`，异步操作完成后兑现，不携带结果值。
   */
  async onceADayForAWeek(type: 'border' | 'avatar'): Promise<void> {
    const now = new Date();
    const currentHour = now.getHours();

    if (currentHour < 13) {
      new Logger(`${time()}${chalk.yellow(__('currentHourNot13'))}`);
      return;
    }

    const today = this.localDate(now);
    const actionHistory = this.readActionHistory();

    if (actionHistory[type]?.date === today) {
      new Logger(`${time()}${__(type === 'border' ? 'todayAlreadyChangedBorder' : 'todayAlreadyChangedAvatar')}`);
      return;
    }

    const itemLookup = await this.awa.personalization.getAvatarItems(type);
    const { userAvatarInfo: UAI, ids } = itemLookup.found ? itemLookup.value : {};
    const existingAvatarInfo = this.userAvatarInfo || UAI;
    if (!ids || !existingAvatarInfo) {
      return;
    }
    const userAvatarInfo = { ...existingAvatarInfo } as userAvatarInfo;

    const usedIds = actionHistory[type].used || [];
    const availableIds = ids.filter((id: Id) => !usedIds.includes(id.id));

    if (availableIds.length === 0) {
      new Logger(`${time()}${__(type === 'border' ? 'noAvailableBorder' : 'noAvailableAvatar')}`);
      return;
    }

    const [selectedId] = availableIds;
    userAvatarInfo[type] = selectedId.id;
    // new Logger(`${time()}${__('changeBorder', chalk.yellow(selectedBorder.id))}`);

    if (!(await this.awa.personalization.saveAvatar(userAvatarInfo)).ok) return;
    this.userAvatarInfo = userAvatarInfo;
    // addLog(`成功切换到边框 ${selectedBorder.name}`, TaskStatus.SUCCESS);

    actionHistory[type].date = today;
    actionHistory[type].used.push(selectedId.id);
    this.writeActionHistory(actionHistory);

    new Logger(`${time()}${__(`${type}ChangeHistorySaved`)}`);
  }

  /**
   * 处理 once AMonth For AYear 相关逻辑。
   * @param type - 用于选择处理分支的类型，类型为 `"avatar" | "border"`。
   * @returns `Promise<void>`，异步操作完成后兑现，不携带结果值。
   */
  async onceAMonthForAYear(type: 'border' | 'avatar'): Promise<void> {
    if (type === 'border' && this.incompletedAchievements.includes('Change your border once a day for a week')) {
      new Logger(`${time()}${__('borderOnceADayForAWeekExist', chalk.blue('Change your border once a day for a week'))}`);
      return;
    }
    if (type === 'avatar' && this.incompletedAchievements.includes('Change your avatar items every day for a week')) {
      new Logger(`${time()}${__('avatarOnceADayForAYearExist', chalk.blue('Change your avatar items every day for a week'))}`);
      return;
    }

    const now = new Date();
    const currentDay = now.getDate();

    if (currentDay < 10) {
      new Logger(`${time()}${__('currentDayNot10')}`);
      return;
    }

    const currentMonth = this.localDate(now).slice(0, 7);
    const actionHistory = this.readActionHistory();

    if (actionHistory[type].date === currentMonth) {
      new Logger(`${time()}${__(`${type}OnceAMonthForAYearAlreadyDone`)}`);
      return;
    }

    const itemLookup = await this.awa.personalization.getAvatarItems(type);
    const { userAvatarInfo: UAI, ids } = itemLookup.found ? itemLookup.value : {};
    const existingAvatarInfo = this.userAvatarInfo || UAI;
    if (!ids || !existingAvatarInfo) {
      return;
    }
    const userAvatarInfo = { ...existingAvatarInfo } as userAvatarInfo;

    const usedIds = actionHistory[type].used || [];
    const availableIds = ids.filter((id: Id) => !usedIds.includes(id.id));

    if (availableIds.length === 0) {
      new Logger(`${time()}${__(type === 'border' ? 'noAvailableBorder' : 'noAvailableAvatar')}`);
      return;
    }

    const [selectedId] = availableIds;
    userAvatarInfo[type] = selectedId.id;
    // new Logger(`${time()}${__('changeBorder', chalk.yellow(selectedBorder.id))}`);

    if (!(await this.awa.personalization.saveAvatar(userAvatarInfo)).ok) return;
    this.userAvatarInfo = userAvatarInfo;
    // addLog(`成功切换到边框 ${selectedBorder.name}`, TaskStatus.SUCCESS);

    actionHistory[type].date = currentMonth;
    actionHistory[type].used.push(selectedId.id);
    this.writeActionHistory(actionHistory);

    new Logger(`${time()}${__(`${type}ChangeHistorySaved`)}`);
  }

  /**
   * 添加 add Watch Twitch 相关数据。
   * @param type - 用于选择处理分支的类型，类型为 `"hive" | "nexus"`。
   * @returns `Promise<void>`，异步操作完成后兑现，不携带结果值。
   */
  async addWatchTwitch(type: 'hive' | 'nexus'): Promise<void> {
    try {
      this.watchTwitchStatus.type.add(type);
    } catch (error) {
      new Logger(`${time()}${__('addWatchTwitchFailed', (error as Error).toString())}`);
    }
  }

  /**
   * 处理 watch Twitch 相关逻辑。
   * @param signal - 用于取消当前异步操作的中止信号，类型为 `AbortSignal | undefined`。
   * @returns `Promise<void>`，异步操作完成后兑现，不携带结果值。
   */
  async watchTwitch(signal?: AbortSignal): Promise<void> {
    if (!this.twitchCookie || this.watchTwitchStatus.type.size === 0 || signal?.aborted) return;
    this.watchTwitchStatus.running = true;
    while (this.watchTwitchStatus.running && !signal?.aborted) {
      try {
        this.twitch = new TwitchClient({ cookie: this.twitchCookie });
        await this.twitch.session.verify();
        if (!(await this.twitch.extensions.checkLinked()).ok) return;
        const { Hive, Nexus } = await this.awa.twitch.getAvailableStreams();
        new Logger(`${time()}${__('foundHiveLive', chalk.yellow(Hive.length))}`);
        new Logger(`${time()}${__('foundNexusLive', chalk.yellow(Nexus.length))}`);
        const candidates = [
          ...(this.watchTwitchStatus.type.has('hive') ? Hive : []),
          ...(this.watchTwitchStatus.type.has('nexus') ? Nexus : [])
        ];
        const trackingLookup = await this.twitch.channels.findTracking(candidates);
        if (!trackingLookup.found) {
          if (!await sleep(5 * 60, signal)) return;
          continue;
        }
        const trackingResult = await this.trackTwitchChannel(trackingLookup.value, signal);
        if (trackingResult === 'retry') {
          new Logger(`${time()}${__('watchTwitchAfter5min')}`);
          if (!await sleep(5 * 60, signal)) return;
          continue;
        }
        return;
      } catch (error) {
        if (signal?.aborted || !this.watchTwitchStatus.running) return;
        new Logger(`${time()}${__('watchTwitchFailed', (error as Error).toString())}`);
        new Logger(`${time()}${__('watchTwitchAfter5min')}`);
        if (!await sleep(5 * 60, signal)) return;
      } finally {
        this.twitch = null;
      }
    }
  }

  /**
   * 处理 track Twitch Channel 相关逻辑。
   * @param info - 提交 Twitch 跟踪请求所需的频道信息，类型为 `TwitchChannelTrackingInfo`。
   * @param signal - 用于取消当前异步操作的中止信号，类型为 `AbortSignal | undefined`。
   * @param heartbeatIntervalSeconds - 两次心跳之间的等待秒数；生产环境固定使用 60 秒。
   * @returns `Promise<'retry' | 'stopped'>`，直播不可用时要求重新选台，任务停止时返回 stopped。
   */
  private async trackTwitchChannel(
    info: TwitchChannelTrackingInfo,
    signal?: AbortSignal,
    heartbeatIntervalSeconds = 60
  ): Promise<'retry' | 'stopped'> {
    while (this.watchTwitchStatus.running && !signal?.aborted) {
      const logger = new Logger(`${time()}${__('sendingOnlineTrack', chalk.yellow('Twitch'))}`, false);
      const result = await this.awa.twitch.sendTrack(info);
      logger.log(result.success ? chalk.green(`OK (${result.state})`) : chalk.red(`Error (${result.state})`));
      if (result.state === 'streamer_offline' || result.state === 'no_channel_found') {
        new Logger(`${time()}${chalk.blue(result.state === 'streamer_offline'
          ? __('liveOffline', chalk.yellow(info.channelId))
          : __('noChannelFound', chalk.yellow(info.channelId)))}`);
        return 'retry';
      }
      if (!result.success) {
        throw new Error(`AWA Twitch tracking failed: ${result.state}`);
      }
      // Achievement watch-time must keep accumulating after the daily ARP cap is reached.
      if (!await sleep(heartbeatIntervalSeconds, signal)) return 'stopped';
    }
    return 'stopped';
  }

  /**
   * 停止 stop 相关数据。
   * @returns `void`，该函数仅执行副作用，不返回值。
   */
  stop(): void {
    this.watchTwitchStatus.running = false;
  }

  /**
   * 处理 destroy 相关逻辑。
   * @returns `void`，该函数仅执行副作用，不返回值。
   */
  destroy(): void {
    this.twitch = null;
    this.watchTwitchStatus = {
      running: false,
      type: new Set()
    };

    // Clear arrays
    if (this.availableAchievements) {
      this.availableAchievements.length = 0;
    }
    if (this.Achievements) {
      this.Achievements.length = 0;
    }
    if (this.incompletedAchievements) {
      this.incompletedAchievements.length = 0;
    }
  }
}
