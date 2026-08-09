/**
 * @file src/core/DailyQuest/tasks/SteamQuestTask.ts
 * @description 协调 AWA Steam 任务信息与 ASF 游戏挂时、许可证和进度轮询。
 */
import chalk from 'chalk';
import { AWAApiClient } from '../../../client/AWA/AWAApiClient';
import { SteamClient } from '../../../client/Steam/SteamClient';
import type { AWASteamQuestListing, PreparedSteamQuest } from '../../../client/AWA/types';
import { Logger, sleep, time } from '../../../tools';

export class SteamQuestTask {
  /**
   * 初始化 Steam Quest Task 实例。
   * @param awa - 用于调用 Alienware Arena 接口的客户端，类型为 `AWAApiClient`。
   * @param asf - 用于控制 ArchiSteamFarm 的客户端，类型为 `SteamClient`。
   * @param eventAppId - 需要处理的 Steam 应用标识列表，类型为 `string | undefined`。
   */
  constructor(private readonly awa: AWAApiClient, private readonly asf: SteamClient, private readonly eventAppId?: string) {}

  /**
   * 执行 run 相关数据。
   * @param signal - 用于取消当前异步操作的中止信号，类型为 `AbortSignal | undefined`。
   * @returns `Promise<boolean>`，表示 run 检查是否通过。
   */
  async run(signal?: AbortSignal): Promise<boolean> {
    const questLogger = new Logger(`${time()}${__('gettingSteamQuestInfo', chalk.yellow('Steam'))}`, false);
    const listings = await this.awa.steam.getSteamQuests().catch((error) => {
      questLogger.log(chalk.red('Error'));
      new Logger(error);
      return null;
    });
    if (!listings) return false;
    const quests: PreparedSteamQuest[] = [];
    for (const listing of listings) {
      const prepared = await this.prepareQuest(listing, signal);
      if (prepared) quests.push(prepared);
      if (signal?.aborted) return true;
    }
    questLogger.log(chalk.green(`OK (${quests.length})`));
    const { eventAppId } = this;
    const requestedIds = [...quests.map((quest) => quest.id), ...(eventAppId ? [eventAppId] : [])];
    if (!requestedIds.length) return true;

    const licenseLogger = new Logger(`${time()}${__('addingLicense')}`, false);
    const licenseResult = await this.asf.licenses.add(requestedIds).catch((error) => {
      licenseLogger.log(chalk.red('Error'));
      new Logger(error);
      return null;
    });
    if (!licenseResult?.ok) return false;
    licenseLogger.log(chalk.green('OK'));
    const matchLogger = new Logger(`${time()}${__('matchingGames', chalk.yellow('Steam'))}`, false);
    const ownedIds = await this.asf.bot.getOwnedGames(requestedIds).catch((error) => {
      matchLogger.log(chalk.red('Error'));
      new Logger(error);
      return null;
    });
    if (!ownedIds) return false;
    if (!ownedIds.length) {
      matchLogger.log(chalk.yellow(__('notOwned')));
      new Logger(`${time()}${chalk.yellow(__('noGamesAlert'))}`);
      return true;
    }
    matchLogger.log(chalk.green(`OK (${ownedIds.length})`));
    const trackedQuests = quests.filter((quest) => ownedIds.includes(quest.id));
    if (!trackedQuests.length && !eventAppId) return false;
    const playLogger = new Logger(`${time()}${__('usingASF', chalk.yellow('ASF'))}`, false);
    const playResult = await this.asf.bot.playGames(ownedIds).catch((error) => {
      new Logger(error);
      return null;
    });
    if (!playResult?.ok) {
      playLogger.log(chalk.red('Error'));
      return false;
    }
    playLogger.log(chalk.green('OK'));

    try {
      if (!await sleep(10 * 60, signal)) return true;
      while (!signal?.aborted) {
        let complete = true;
        for (const quest of trackedQuests) {
          const progressResult = await this.awa.steam.getQuestProgress(quest.link);
          const progress = progressResult.found ? progressResult.value : null;
          if (progress === null || progress < 100) complete = false;
          new Logger(`${time()}${__('checkingProgress', chalk.yellow(quest.link))}: ${progress ?? '-'}%`);
        }
        if (complete && !eventAppId) return true;
        if (!await sleep(10 * 60, signal)) return true;
      }
      return true;
    } finally {
      const stopLogger = new Logger(`${time()}${__('stoppingPlayingGames')}`, false);
      const stopResult = await this.asf.bot.stopGames().catch((error) => {
        new Logger(error);
        return null;
      });
      stopLogger.log(stopResult?.ok ? chalk.green('OK') : chalk.red('Error'));
    }
  }

  /**
   * 处理 prepare Quest 相关逻辑。
   * @param listing - 从 AWA 获取的 Steam 任务列表项，类型为 `AWASteamQuestListing`。
   * @param signal - 用于取消当前异步操作的中止信号，类型为 `AbortSignal | undefined`。
   * @returns `Promise<PreparedSteamQuest | null>`，准备完成的 Steam 任务；任务不可执行时返回 `null`。
   */
  private async prepareQuest(listing: AWASteamQuestListing, signal?: AbortSignal): Promise<PreparedSteamQuest | null> {
    for (let attempt = 0; attempt < 5 && !signal?.aborted; attempt++) {
      const detail = await this.awa.steam.getQuestDetail(listing.link);
      if (detail.state === 'ready' && detail.appId) return { ...listing, id: detail.appId };
      if (detail.state === 'completed' || detail.state === 'unknown') return null;
      if (detail.state === 'ownership-required') {
        if (!(await this.awa.steam.checkOwnedGames(listing.name)).ok) return null;
        continue;
      }
      if (detail.state === 'selection-required') {
        let gameLookup = await this.awa.steam.getSelectableGameId(listing.link);
        if (!gameLookup.found && (await this.awa.steam.syncGames(listing.link)).ok) {
          gameLookup = await this.awa.steam.getSelectableGameId(listing.link);
        }
        if (!gameLookup.found || !(await this.awa.steam.selectGame(listing.link, gameLookup.value)).ok) return null;
        continue;
      }
      if (detail.state === 'not-started') {
        if (!(await this.awa.steam.startQuest(listing.link)).ok) return null;
      }
    }
    return null;
  }
}
