/** @description Claims a directly awardable AWA quest. */
import type { AWAClient } from '../AWAClient';
const questAward = (client: AWAClient, questId: string): Promise<boolean> => client.questAward(questId);
export { questAward };
