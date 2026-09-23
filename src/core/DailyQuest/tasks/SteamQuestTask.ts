/**
 * @file src/core/DailyQuest/tasks/SteamQuestTask.ts
 * @description 协调 AWA Steam 任务信息与 ASF 游戏挂时、许可证和进度轮询。
 */
import { runWithRequestSignal } from '../../../tools/http/RequestContext';
import chalk from 'chalk';
import { AWAApiClient } from '../../../client/AWA/AWAApiClient';
import { SteamClient } from '../../../client/Steam/SteamClient';
import type { AWASteamQuestListing, PreparedSteamQuest } from '../../../client/AWA/types';
import { Logger, sleep, time } from '../../../tools';

export class SteamQuestTask {
  /**
   * 初始化 SteamQuestTask 实例。
   * @param awa - 用于调用 Alienware Arena 接口的客户端，类型为 `AWAApiClient`。
   * @param asf - 用于控制 ArchiSteamFarm 的客户端，类型为 `SteamClient`。
   * @param getEventAppId - 动态读取尚未完成的社区活动 Steam 应用标识。
   * @param pollDelaySeconds - 首次检查及后续轮询的等待秒数。
   */
  constructor(
    private readonly awa: AWAApiClient,
    private readonly asf: SteamClient,
    private readonly getEventAppId: () => string | undefined = () => undefined,
    private readonly pollDelaySeconds = 10 * 60
  ) {}

  /**
   * 执行任务。
   * @param signal - 用于取消当前异步操作的中止信号，类型为 `AbortSignal | undefined`。
   * @returns `Promise<boolean>`，表示 run 检查是否通过。
   */
  run(signal?: AbortSignal): Promise<boolean> {
    return runWithRequestSignal(signal ?? new AbortController().signal, () => this.runTask(signal));
  }

  private async runTask(signal?: AbortSignal): Promise<boolean> {
    if (signal?.aborted) {
      return false;
    }
    const questLogger = new Logger(`${time()}${__('gettingSteamQuestInfo', chalk.yellow('Steam'))}`, false);
    const listings = await this.awa.steam.getSteamQuests().catch((error) => {
      questLogger.log(chalk.red(__('logStatusError')));
      throw new Error(__('gettingSteamQuestInfo', 'Steam'), {
        cause: error
      });
    });
    if (!listings || signal?.aborted) {
      return false;
    }
    const quests: PreparedSteamQuest[] = [];
    for (const listing of listings) {
      const prepared = await this.prepareQuest(listing, signal).catch((error) => {
        throw new Error(`${__('gettingSteamQuestInfo', 'Steam')} [${listing.name}] ${listing.link}`, {
          cause: error
        });
      });
      if (prepared) {
        quests.push(prepared);
      }
      if (signal?.aborted) {
        return true;
      }
    }
    questLogger.log(chalk.green(`${__('logStatusOk')} (${quests.length})`));
    const eventAppId = this.getEventAppId();
    const requestedIds = [...quests.map((quest) => quest.id), ...(eventAppId ? [eventAppId] : [])];
    if (!requestedIds.length) {
      return true;
    }

    if (signal?.aborted) {
      return false;
    }
    const licenseLogger = new Logger(`${time()}${__('addingLicense')}`, false);
    const licenseResult = await this.asf.licenses.add(requestedIds).catch((error) => {
      licenseLogger.log(chalk.red(__('logStatusError')));
      throw new Error(__('addingLicense'), {
        cause: error
      });
    });
    if (signal?.aborted) {
      return false;
    }
    if (!licenseResult.ok) {
      throw new Error(`${__('addingLicense')}: ${licenseResult.state}`);
    }
    licenseLogger.log(chalk.green(__('logStatusOk')));
    const matchLogger = new Logger(`${time()}${__('matchingGames', chalk.yellow('Steam'))}`, false);
    const ownedIds = await this.asf.bot.getOwnedGames(requestedIds).catch((error) => {
      matchLogger.log(chalk.red(__('logStatusError')));
      throw new Error(__('matchingGames', 'Steam'), {
        cause: error
      });
    });
    if (!ownedIds || signal?.aborted) {
      return false;
    }
    if (!ownedIds.length) {
      matchLogger.log(chalk.yellow(__('notOwned')));
      new Logger(`${time()}${chalk.yellow(__('noGamesAlert'))}`);
      return true;
    }
    matchLogger.log(chalk.green(`${__('logStatusOk')} (${ownedIds.length})`));
    const trackedQuests = quests.filter((quest) => ownedIds.includes(quest.id));
    if (!trackedQuests.length && !eventAppId) {
      throw new Error(__('steamNoMatchingQuests'));
    }
    const playLogger = new Logger(`${time()}${__('usingASF', chalk.yellow('ASF'))}`, false);
    try {
      const playResult = await this.asf.bot.playGames(ownedIds).catch((error) => {
        playLogger.log(chalk.red(__('logStatusError')));
        throw new Error(__('usingASF', 'ASF'), {
          cause: error
        });
      });
      if (!playResult?.ok) {
        playLogger.log(chalk.red(__('logStatusError')));
        throw new Error(`${__('usingASF', 'ASF')}: ${playResult.state}`);
      }
      playLogger.log(chalk.green(__('logStatusOk')));

      if (!await sleep(this.pollDelaySeconds, signal)) {
        return true;
      }
      while (!signal?.aborted) {
        let complete = true;
        for (const quest of trackedQuests) {
          if (signal?.aborted) {
            return false;
          }
          const progressResult = await this.awa.steam.getQuestProgress(quest.link).catch((error) => {
            throw new Error(__('checkingProgress', quest.link), {
              cause: error
            });
          });
          const progress = progressResult.found ? progressResult.value : null;
          if (progress === null || progress < 100) {
            complete = false;
          }
          new Logger(`${time()}${__('checkingProgress', chalk.yellow(quest.link))}: ${progress ?? '-'}%`);
        }
        if (complete && !this.getEventAppId()) {
          return true;
        }
        if (!await sleep(this.pollDelaySeconds, signal)) {
          return true;
        }
      }
      return true;
    } finally {
      const stopLogger = new Logger(`${time()}${__('stoppingPlayingGames')}`, false);
      const stopResult = await runWithRequestSignal(AbortSignal.timeout(15_000), () => this.asf.bot.stopGames(), true).catch((error) => {
        new Logger(error);
        return null;
      });
      stopLogger.log(stopResult?.ok ? chalk.green(__('logStatusOk')) : chalk.red(__('logStatusError')));
    }
  }

  /**
   * 准备任务。
   * @param listing - 从 AWA 获取的 Steam 任务列表项，类型为 `AWASteamQuestListing`。
   * @param signal - 用于取消当前异步操作的中止信号，类型为 `AbortSignal | undefined`。
   * @returns `Promise<PreparedSteamQuest | null>`，准备完成的 Steam 任务；任务不可执行时返回 `null`。
   */
  private async prepareQuest(listing: AWASteamQuestListing, signal?: AbortSignal): Promise<PreparedSteamQuest | null> {
    for (let attempt = 0; attempt < 5 && !signal?.aborted; attempt++) {
      const detail = await this.awa.steam.getQuestDetail(listing.link);
      if (signal?.aborted) {
        return null;
      }
      if (detail.state === 'ready' && detail.appId) {
        return {
          ...listing,
          id: detail.appId
        };
      }
      if (detail.state === 'completed' || detail.state === 'unknown') {
        return null;
      }
      if (detail.state === 'ownership-required') {
        if (!(await this.awa.steam.checkOwnedGames(listing.name)).ok) {
          return null;
        }
        continue;
      }
      if (detail.state === 'selection-required') {
        let gameLookup = await this.awa.steam.getSelectableGameId(listing.link);
        if (signal?.aborted) {
          return null;
        }
        if (!gameLookup.found && (await this.awa.steam.syncGames(listing.link)).ok) {
          if (signal?.aborted) {
            return null;
          }
          gameLookup = await this.awa.steam.getSelectableGameId(listing.link);
        }
        if (signal?.aborted || !gameLookup.found || !(await this.awa.steam.selectGame(listing.link, gameLookup.value)).ok) {
          return null;
        }
        continue;
      }
      if (detail.state === 'not-started') {
        if (!(await this.awa.steam.startQuest(listing.link)).ok) {
          return null;
        }
      }
    }
    return null;
  }
}
