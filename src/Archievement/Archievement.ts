/*
 * @Author       : HCLonely
 * @Date         : 2026-01-05 10:15:36
 * @LastEditTime : 2026-04-03 10:43:46
 * @LastEditors  : HCLonely
 * @FilePath     : /AWA-Helper/src/Archievement/Archievement.ts
 * @Description  : 任务执行器
 */

/* global __, proxy */
import { Achievement, ActionHistory, Border } from './types';
import { AWA } from './AWA';
import { sleep, Logger, time } from './tool';
import { Twitch } from './Twitch';
import * as chalk from 'chalk';
import * as fs from 'fs';

export class Archievement {
  awa: AWA;
  twitch!: Twitch | null;
  twitchCookie?: string;
  availableAchievements: Array<string> = [
    'Use 25 different borders',
    'Change your border once a day for a week',
    'Change your border once a month for a year',
    // 'Change your avatar items every day for a week',
    // 'Change your avatar once a month for 1 year',
    'Watch 1000 Hours of Twitch.tv on Hive channels',
    'Watch 1000 Hours of Twitch.tv on Nexus channels'
  ];
  Achievements!: Array<Achievement>;
  achievement2action: {
    [key in typeof this.availableAchievements[number]]: () => Promise<void>; // eslint-disable-line
  } = {
      'Use 25 different borders': () => this.border25(),
      'Change your border once a day for a week': () => this.borderOnceADayForAWeek(),
      'Change your border once a month for a year': () => this.borderOnceAMonthForAYear(),
      // 'Change your avatar items every day for a week': () => this.avatarItemsEveryDayForAWeek(),
      // 'Change your avatar once a month for 1 year': () => this.avatarOnceAMonthForAYear(),
      'Watch 1000 Hours of Twitch.tv on Hive channels': () => this.addWatchTwitch('hive'),
      'Watch 1000 Hours of Twitch.tv on Nexus channels': () => this.addWatchTwitch('nexus')
    };
  incompletedAchievements: Array<string> = [];
  actionHistoryPath: string = 'data/actionHistory';
  watchTwitchStatus: {
    running: boolean,
    type: Set<'hive' | 'nexus'>
  } = {
      running: false,
      type: new Set()
    };

  constructor({ awaCookie, proxy, awaHost, twitchCookie, userAgent }: { awaCookie: string; proxy?: proxy; awaHost: string; twitchCookie?: string; userAgent?: string }) {
    this.awa = new AWA({
      awaCookie,
      proxy,
      awaHost,
      userAgent
    });
    if (twitchCookie) {
      this.twitchCookie = twitchCookie;
    }
  }
  async init(): Promise<void> {
    await this.awa.init();
    this.Achievements = await this.awa.getAchievements();
    if (!fs.existsSync('data')) {
      fs.mkdirSync('data');
    }
    if (!fs.existsSync(this.actionHistoryPath)) {
      fs.writeFileSync(this.actionHistoryPath, JSON.stringify({ border: { date: '', used: [] }, avatar: { date: '', used: {} } }));
    }
  }
  async run(): Promise<void> {
    new Logger(`${time()}${__('matching', chalk.yellow('Achievements'))}`);
    // addLog('开始匹配可操作的成就', TaskStatus.RUNNING);

    for (const availableAchievement of this.availableAchievements) {
      const achievement = this.Achievements.find((achievement) => achievement.description === availableAchievement && !achievement.completed);
      if (achievement) {
        this.incompletedAchievements.push(availableAchievement);
        new Logger(`${time()}${__('doingAchievement', chalk.yellow(availableAchievement))}`);
        await this.achievement2action[availableAchievement]();
        new Logger(`${time()}${__('doneAchievement', chalk.yellow(availableAchievement))}`);
      }
    }
    this.watchTwitch();
    new Logger(`${time()}${__('doneMatch', chalk.yellow('Achievements'))}`);
  }

  async border25(): Promise<void> {
    const borders = await this.awa.getBorders();
    if (!borders) {
      return;
    }
    const borderIds = borders.map((border:Border) => border.id);
    if (borderIds.length < 25) {
      new Logger(`${time()}${__('notEnoughBorders', chalk.yellow('25'))}`);
      return;
    }
    new Logger(`${time()}${__('foundEnoughBorders', chalk.green('25'))}`);
    // addLog('找到足够的边框(25个)', TaskStatus.SUCCESS);

    for (let i = 0; i < 25; i++) {
      const borderId = borderIds[i];
      await this.awa.changeBorder(parseInt(borderId, 10));
      // new Logger(`${time()}${__('changeBorder', chalk.yellow(borderId))}`, false);
      await sleep(5);
    }
    new Logger(`${time()}${chalk.green(__('doneBorder25'))}`);
  }

  async borderOnceADayForAWeek(): Promise<void> {
    const now = new Date();
    const currentHour = now.getHours();

    if (currentHour < 13) {
      new Logger(`${time()}${chalk.yellow(__('currentHourNot13'))}`);
      return;
    }

    const [today] = now.toISOString().split('T');

    const defaultHistory: ActionHistory = { border: { date: '', used: [] }, avatar: { date: '', used: {} } };
    const actionHistory: ActionHistory = JSON.parse(fs.readFileSync(this.actionHistoryPath).toString()) || defaultHistory;

    if (actionHistory.border?.date === today) {
      new Logger(`${time()}${__('todayAlreadyChangedBorder')}`);
      return;
    }

    // new Logger(`${time()}${__('gettingBorder')}`);
    const borders = await this.awa.getBorders();
    if (!borders) {
      return;
    }
    const usedBorderIds = actionHistory.border.used || [];
    const availableBorders = borders.filter((border: Border) => !usedBorderIds.includes(border.id));

    if (availableBorders.length === 0) {
      new Logger(`${time()}${__('noAvailableBorder')}`);
      return;
    }

    const [selectedBorder] = availableBorders;
    // addLog(`准备切换到边框 ${selectedBorder.name} (ID: ${selectedBorder.id})`, TaskStatus.RUNNING);

    await this.awa.changeBorder(parseInt(selectedBorder.id, 10));
    // new Logger(`${time()}${__('changeBorder', chalk.yellow(selectedBorder.id))}`);

    actionHistory.border.date = today;
    actionHistory.border.used.push(selectedBorder.id);
    fs.writeFileSync(this.actionHistoryPath, JSON.stringify(actionHistory));

    new Logger(`${time()}${__('borderChangeHistorySaved')}`);
  }

  async borderOnceAMonthForAYear(): Promise<void> {
    if (this.incompletedAchievements.includes('Change your border once a day for a week')) {
      new Logger(`${time()}${__('borderOnceADayForAWeekExist', chalk.blue('Change your border once a day for a week'))}`);
      return;
    }

    const now = new Date();
    const currentDay = now.getDate();

    if (currentDay < 10) {
      new Logger(`${time()}${__('currentDayNot10')}`);
      return;
    }

    const currentMonth = now.toISOString().substring(0, 7);

    const defaultHistory: ActionHistory = { border: { date: '', used: [] }, avatar: { date: '', used: {} } };
    const actionHistory: ActionHistory = JSON.parse(fs.readFileSync(this.actionHistoryPath).toString()) || defaultHistory;

    if (actionHistory.border.date === currentMonth) {
      new Logger(`${time()}${__('borderOnceAMonthForAYearAlreadyDone')}`);
      return;
    }

    // new Logger(`${time()}${__('gettingBorder')}`);
    const borders = await this.awa.getBorders();
    if (!borders) {
      return;
    }

    const usedBorderIds = actionHistory.border.used || [];
    const availableBorders = borders.filter((border: Border) => !usedBorderIds.includes(border.id));

    if (availableBorders.length === 0) {
      new Logger(`${time()}${__('noAvailableBorder')}`);
      return;
    }

    const [selectedBorder] = availableBorders;
    // new Logger(`${time()}${__('changeBorder', chalk.yellow(selectedBorder.id))}`);

    await this.awa.changeBorder(parseInt(selectedBorder.id, 10));
    // addLog(`成功切换到边框 ${selectedBorder.name}`, TaskStatus.SUCCESS);

    actionHistory.border.date = currentMonth;
    actionHistory.border.used.push(selectedBorder.id);
    fs.writeFileSync(this.actionHistoryPath, JSON.stringify(actionHistory));

    new Logger(`${time()}${__('borderChangeHistorySaved')}`);
  }

  async avatarItemsEveryDayForAWeek(): Promise<void> {
    const now = new Date();
    const currentHour = now.getHours();

    if (currentHour < 13) {
      new Logger(`${time()}${__('currentHourNot13')}`);
      return;
    }

    const [today] = now.toISOString().split('T');

    const defaultHistory: ActionHistory = { border: { date: '', used: [] }, avatar: { date: '', used: {} } };
    const actionHistory: ActionHistory = JSON.parse(fs.readFileSync(this.actionHistoryPath).toString()) || defaultHistory;

    if (actionHistory.avatar?.date === today) {
      new Logger(`${time()}${__('todayAlreadyChangedAvatar')}`);
      return;
    }

    // new Logger(`${time()}${__('gettingAvatar')}`);
    const avatars = await this.awa.getAvatar();
    if (!avatars?.length) {
      new Logger(`${time()}${__('noAvailableAvatar')}`);
      return;
    }

    // const slotTypes = ['body', 'hat', 'top', 'item', 'legs', 'feet'];
    // const newAvatar = { ...currentAvatar };

    // for (const slotType of slotTypes) {
    //   const usedIds = actionHistory.avatar.used[slotType] || [];
    //   const currentEquippedId = currentAvatar[slotType as keyof typeof currentAvatar]?.id;

    //   // 过滤出未使用且不是当前装备的物品
    //   const slotAvatars = avatars.filter((a: Avatar) => a.slotType === slotType &&
    //     !usedIds.includes(a.id) &&
    //     a.id !== currentEquippedId
    //   );

    //   if (slotAvatars.length > 0) {
    //     const [selectedAvatar] = slotAvatars;
    //     newAvatar[slotType as keyof typeof newAvatar] = { id: selectedAvatar.id };

    //     if (!actionHistory.avatar.used[slotType]) {
    //       actionHistory.avatar.used[slotType] = [];
    //     }
    //     actionHistory.avatar.used[slotType].push(selectedAvatar.id);

    //     new Logger(`${time()}${__('selectedAvatar', chalk.yellow(`${slotType}: ${selectedAvatar.name}`))}`);
    //   }
    // }

    // if (JSON.stringify(newAvatar) === JSON.stringify(currentAvatar)) {
    //   new Logger(`${time()}${__('noAvailableAvatar')}`);
    //   return;
    // }

    // new Logger(`${time()}${__('changingAvatar')}`);
    await this.awa.changeAvatar(avatars.at(-1) as string);
    // addLog('成功更换 Avatar 配置', TaskStatus.SUCCESS);

    actionHistory.avatar.date = today;
    fs.writeFileSync(this.actionHistoryPath, JSON.stringify(actionHistory));

    new Logger(`${time()}${__('avatarChangeHistorySaved')}`);
  }

  async avatarOnceAMonthForAYear(): Promise<void> {
    if (this.incompletedAchievements.includes('Change your avatar items every day for a week')) {
      new Logger(`${time()}${__('avatarOnceADayForAYearExist', chalk.blue('Change your avatar items every day for a week'))}`);
      return;
    }

    const now = new Date();
    const currentDay = now.getDate();

    if (currentDay < 10) {
      new Logger(`${time()}${__('currentDayNot10')}`);
      return;
    }

    const currentMonth = now.toISOString().substring(0, 7);

    const defaultHistory: ActionHistory = { border: { date: '', used: [] }, avatar: { date: '', used: {} } };
    const actionHistory: ActionHistory = JSON.parse(fs.readFileSync(this.actionHistoryPath).toString()) || defaultHistory;

    if (actionHistory.avatar.date === currentMonth) {
      new Logger(`${time()}${__('avatarOnceAMonthForAYearAlreadyDone')}`);
      return;
    }

    // new Logger(`${time()}${__('gettingAvatar')}`);
    const avatars = await this.awa.getAvatar();
    if (!avatars?.length) {
      new Logger(`${time()}${__('noAvailableAvatar')}`);
      return;
    }

    // const slotTypes = ['body', 'hat', 'top', 'item', 'legs', 'feet'];
    // const newAvatar = { ...currentAvatar };
    // // let foundNewItem = true;

    // for (const slotType of slotTypes) {
    //   const usedIds = actionHistory.avatar.used[slotType] || [];
    //   const currentEquippedId = currentAvatar[slotType as keyof typeof currentAvatar]?.id;

    //   // 过滤出未使用且不是当前装备的物品
    //   const slotAvatars = avatars.filter((a: Avatar) => a.slotType === slotType &&
    //     !usedIds.includes(a.id) &&
    //     a.id !== currentEquippedId
    //   );

    //   if (slotAvatars.length > 0) {
    //     const [selectedAvatar] = slotAvatars;
    //     newAvatar[slotType as keyof typeof newAvatar] = { id: selectedAvatar.id };

    //     if (!actionHistory.avatar.used[slotType]) {
    //       actionHistory.avatar.used[slotType] = [];
    //     }
    //     actionHistory.avatar.used[slotType].push(selectedAvatar.id);

    //     new Logger(`${time()}${__('selectedAvatar', chalk.yellow(`[${slotType}]: ${selectedAvatar.name}`))}`);
    //     // foundNewItem = true;
    //     // break;
    //   }
    // }

    // if (JSON.stringify(newAvatar) === JSON.stringify(currentAvatar)) {
    //   new Logger(`${time()}${__('noAvailableAvatar')}`);
    //   return;
    // }

    // new Logger(`${time()}${__('changingAvatar')}`);
    await this.awa.changeAvatar(avatars.at(-1) as string);
    // addLog('成功更换 Avatar 配置', TaskStatus.SUCCESS);

    actionHistory.avatar.date = currentMonth;
    fs.writeFileSync(this.actionHistoryPath, JSON.stringify(actionHistory));

    new Logger(`${time()}${__('avatarChangeHistorySaved')}`);
  }

  async addWatchTwitch(type: 'hive' | 'nexus'): Promise<void> {
    try {
      this.watchTwitchStatus.type.add(type);
    } catch (error) {
      new Logger(`${time()}${__('addWatchTwitchFailed', (error as Error).toString())}`);
    }
  }

  async watchTwitch(): Promise<void> {
    try {
      if (!this.twitchCookie) {
        return;
      }

      this.twitch = new Twitch({ cookie: this.twitchCookie });
      // await twitch.start(type);

      const initStatus = await this.twitch.init();
      if (!initStatus) {
        return;
      }
      this.watchTwitchStatus.running = true;

      const { Hive, Nexus } = await this.awa.getAvailableStreams();
      new Logger(`${time()}${__('foundHiveLive', chalk.yellow(Hive.length))}`);
      new Logger(`${time()}${__('foundNexusLive', chalk.yellow(Nexus.length))}`);

      if (Hive.length > 0 && this.watchTwitchStatus.type.has('hive')) {
        const { channelId, jwt, extensionID } = await this.twitch.getChannelInfo(Hive);
        if (!channelId || !jwt) {
          this.twitch?.destroy();
          this.twitch = null;
          return this.watchTwitch();
        }

        await this.twitch.sendTrack({ channelId, jwt, extensionID }).catch(async () => {
          await sleep(5 * 60);
          this.twitch?.destroy();
          this.twitch = null;
          return this.watchTwitch();
        });
      }

      if (Nexus.length > 0 && this.watchTwitchStatus.type.has('nexus')) {
        const { channelId, jwt, extensionID } = await this.twitch.getChannelInfo(Nexus);
        if (!channelId || !jwt) {
          this.twitch?.destroy();
          this.twitch = null;
          return this.watchTwitch();
        }

        await this.twitch.sendTrack({ channelId, jwt, extensionID }).catch(async () => {
          new Logger(`${time()}${__('watchTwitchAfter5min')}`);
          await sleep(5 * 60);
          this.twitch?.destroy();
          this.twitch = null;
          return this.watchTwitch();
        });
      }
    } catch (error) {
      new Logger(`${time()}${__('watchTwitchFailed', (error as Error).toString())}`);
    }
  }

  destroy(): void {
    // Destroy AWA instance
    if (this.awa) {
      this.awa.destroy();
      this.awa = null as any;
    }
    // Destroy Twitch instance
    if (this.twitch) {
      this.twitch.destroy();
      this.twitch = null as any;
    }
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

    // Clear achievement2action object
    if (this.achievement2action) {
      this.achievement2action = {} as any;
    }
  }
}
