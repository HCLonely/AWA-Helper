/** Coordinates AWA Steam quest APIs with ASF bot operations. */
import chalk from 'chalk';
import { AWAApiClient } from '../../../client/AWA/AWAApiClient';
import { SteamClient } from '../../../client/Steam/SteamClient';
import type { AWASteamQuestListing, PreparedSteamQuest } from '../../../client/AWA/types';
import { Logger, sleep, time } from '../../../tools';

export class SteamQuestTask {
  constructor(private readonly awa: AWAApiClient, private readonly asf: SteamClient, private readonly eventAppId?: string) {}

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
    const licenseAdded = await this.asf.addLicense(requestedIds).catch((error) => {
      licenseLogger.log(chalk.red('Error'));
      new Logger(error);
      return false;
    });
    if (!licenseAdded) return false;
    licenseLogger.log(chalk.green('OK'));
    const matchLogger = new Logger(`${time()}${__('matchingGames', chalk.yellow('Steam'))}`, false);
    const ownedIds = await this.asf.getOwnedGames(requestedIds).catch((error) => {
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
    const started = await this.asf.playGames(ownedIds).catch((error) => {
      new Logger(error);
      return false;
    });
    if (!started) {
      playLogger.log(chalk.red('Error'));
      return false;
    }
    playLogger.log(chalk.green('OK'));

    try {
      if (!await sleep(10 * 60, signal)) return true;
      while (!signal?.aborted) {
        let complete = true;
        for (const quest of trackedQuests) {
          const progress = await this.awa.steam.getQuestProgress(quest.link);
          if (progress === null || progress < 100) complete = false;
          new Logger(`${time()}${__('checkingProgress', chalk.yellow(quest.link))}: ${progress ?? '-'}%`);
        }
        if (complete && !eventAppId) return true;
        if (!await sleep(10 * 60, signal)) return true;
      }
      return true;
    } finally {
      await this.asf.resume().catch(() => false);
    }
  }

  /** Coordinates the multi-request AWA preparation flow without leaking it into the API layer. */
  private async prepareQuest(listing: AWASteamQuestListing, signal?: AbortSignal): Promise<PreparedSteamQuest | null> {
    for (let attempt = 0; attempt < 5 && !signal?.aborted; attempt++) {
      const detail = await this.awa.steam.getQuestDetail(listing.link);
      if (detail.state === 'ready' && detail.appId) return { ...listing, id: detail.appId };
      if (detail.state === 'completed' || detail.state === 'unknown') return null;
      if (detail.state === 'ownership-required') {
        if (!await this.awa.steam.checkOwnedGames(listing.name)) return null;
        continue;
      }
      if (detail.state === 'selection-required') {
        let gameId = await this.awa.steam.getSelectableGameId(listing.link);
        if (!gameId && await this.awa.steam.syncGames(listing.link)) {
          gameId = await this.awa.steam.getSelectableGameId(listing.link);
        }
        if (!gameId || !await this.awa.steam.selectGame(listing.link, gameId)) return null;
        continue;
      }
      if (detail.state === 'not-started') {
        if (!await this.awa.steam.startQuest(listing.link)) return null;
      }
    }
    return null;
  }
}
