/**
 * @file AchievementService
 * @description Executes Achievement automation exclusively as a Manager-owned job.
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
      'Use 25 different borders': () => this.border25(),
      'Change your border once a day for a week': () => this.onceADayForAWeek('border'),
      'Change your border once a month for a year': () => this.onceAMonthForAYear('border'),
      'Change your avatar items every day for a week': () => this.onceADayForAWeek('avatar'),
      'Change your avatar once a month for 1 year': () => this.onceAMonthForAYear('avatar'),
      'Watch 1000 Hours of Twitch.tv on Hive channels': () => this.addWatchTwitch('hive'),
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
  private writeActionHistory(actionHistory: ActionHistory): void {
    atomicWriteFileSync(this.actionHistoryPath, JSON.stringify(actionHistory));
  }
  private localDate(now: Date): string {
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  async init(): Promise<void> {
    if (!await this.awa.init()) throw new Error('Achievement AWA initialization failed');
    this.Achievements = await this.awa.getAchievements();
    fs.mkdirSync('data/achievement', { recursive: true });
    if (!fs.existsSync(this.actionHistoryPath)) {
      atomicWriteFileSync(this.actionHistoryPath, JSON.stringify({ border: { date: '', used: [] }, avatar: { date: '', used: [] } }));
    }
  }
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

  async border25(): Promise<void> {
    const { userAvatarInfo: UAI, ids: borders } = await this.awa.getAvatarItems('border') || {};
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
      if (!await this.awa.saveAvatar(userAvatarInfo)) return;
      this.userAvatarInfo = userAvatarInfo;
      // new Logger(`${time()}${__('changeBorder', chalk.yellow(borderId))}`, false);
      await sleep(5);
    }
    new Logger(`${time()}${chalk.green(__('doneBorder25'))}`);
  }

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

    // new Logger(`${time()}${__('gettingBorder')}`);
    const { userAvatarInfo: UAI, ids } = await this.awa.getAvatarItems(type) || {};
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

    if (!await this.awa.saveAvatar(userAvatarInfo)) return;
    this.userAvatarInfo = userAvatarInfo;
    // addLog(`成功切换到边框 ${selectedBorder.name}`, TaskStatus.SUCCESS);

    actionHistory[type].date = today;
    actionHistory[type].used.push(selectedId.id);
    this.writeActionHistory(actionHistory);

    new Logger(`${time()}${__(`${type}ChangeHistorySaved`)}`);
  }

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

    // new Logger(`${time()}${__('gettingBorder')}`);
    const { userAvatarInfo: UAI, ids } = await this.awa.getAvatarItems(type) || {};
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

    if (!await this.awa.saveAvatar(userAvatarInfo)) return;
    this.userAvatarInfo = userAvatarInfo;
    // addLog(`成功切换到边框 ${selectedBorder.name}`, TaskStatus.SUCCESS);

    actionHistory[type].date = currentMonth;
    actionHistory[type].used.push(selectedId.id);
    this.writeActionHistory(actionHistory);

    new Logger(`${time()}${__(`${type}ChangeHistorySaved`)}`);
  }

  async addWatchTwitch(type: 'hive' | 'nexus'): Promise<void> {
    try {
      this.watchTwitchStatus.type.add(type);
    } catch (error) {
      new Logger(`${time()}${__('addWatchTwitchFailed', (error as Error).toString())}`);
    }
  }

  async watchTwitch(signal?: AbortSignal): Promise<void> {
    if (!this.twitchCookie || this.watchTwitchStatus.type.size === 0 || signal?.aborted) return;
    this.watchTwitchStatus.running = true;
    while (this.watchTwitchStatus.running && !signal?.aborted) {
      try {
        this.twitch = new TwitchClient({ cookie: this.twitchCookie });
        if (!await this.twitch.init()) return;
        const { Hive, Nexus } = await this.awa.getAvailableStreams();
        new Logger(`${time()}${__('foundHiveLive', chalk.yellow(Hive.length))}`);
        new Logger(`${time()}${__('foundNexusLive', chalk.yellow(Nexus.length))}`);
        const candidates = [
          ...(this.watchTwitchStatus.type.has('hive') ? Hive : []),
          ...(this.watchTwitchStatus.type.has('nexus') ? Nexus : [])
        ];
        const trackingInfo = await this.twitch.findTrackingChannel(candidates);
        if (!trackingInfo) {
          if (!await sleep(5 * 60, signal)) return;
          continue;
        }
        await this.trackTwitchChannel(trackingInfo, signal);
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

  /** Manager-owned Achievement orchestration for repeated AWA heartbeats. */
  private async trackTwitchChannel(info: TwitchChannelTrackingInfo, signal?: AbortSignal): Promise<void> {
    while (this.watchTwitchStatus.running && !signal?.aborted) {
      const result = await this.awa.sendTwitchTrack(info);
      if (!result.success || result.state === 'streamer_offline' || result.state === 'no_channel_found') {
        throw new Error(`AWA Twitch tracking failed: ${result.state}`);
      }
      if (result.state === 'daily_cap_reached') return;
      if (!await sleep(60, signal)) return;
    }
  }

  /** Requests cooperative shutdown; the owning Manager job performs final cleanup. */
  stop(): void {
    this.watchTwitchStatus.running = false;
  }

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
