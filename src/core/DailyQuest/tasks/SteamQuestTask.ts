/** Coordinates AWA Steam quest APIs with ASF bot operations. */
import chalk from 'chalk';
import { AWAApiClient } from '../../../client/AWA/AWAApiClient';
import { SteamClient } from '../../../client/Steam/SteamClient';
import { Logger, sleep, time } from '../../../tools';

export class SteamQuestTask {
  constructor(private readonly awa: AWAApiClient, private readonly asf: SteamClient) {}

  async run(signal?: AbortSignal): Promise<boolean> {
    const quests = await this.awa.steam.getSteamQuests();
    const eventAppId = globalThis.steamEventGameId;
    const requestedIds = [...quests.map((quest) => quest.id), ...(eventAppId ? [eventAppId] : [])];
    if (!requestedIds.length) return true;

    await this.asf.addLicense(requestedIds);
    const ownedIds = await this.asf.getOwnedGames(requestedIds);
    if (!ownedIds.length) {
      new Logger(`${time()}${chalk.yellow(__('noGamesAlert'))}`);
      return true;
    }
    const trackedQuests = quests.filter((quest) => ownedIds.includes(quest.id));
    if (!trackedQuests.length && !eventAppId) return false;
    if (!await this.asf.playGames(ownedIds)) return false;

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
}
