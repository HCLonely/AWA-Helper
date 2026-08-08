/** @description Initializes the Steam/ASF connection. */
import type { SteamClient } from '../SteamClient';
const init = (client: SteamClient): Promise<boolean> => client.init();
export { init };
