/** @description Runs Steam quest tracking until completion or cancellation. */
import type { SteamClient } from '../SteamClient';
const trackQuestStatus = (client: SteamClient, signal?: AbortSignal): Promise<boolean> => client.do(signal);
export { trackQuestStatus };
