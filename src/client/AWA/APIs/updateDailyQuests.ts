/** @description Fetches the AWA control center and updates parsed DailyQuest state. */
import type { AWAClient } from '../AWAClient';
const updateDailyQuests = (client: AWAClient, verify = false): Promise<number> => client.updateDailyQuests(verify);
export { updateDailyQuests };
