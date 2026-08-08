/** @description Initializes and verifies a Twitch session. */
import type { TwitchClient } from '../TwitchClient';
const init = (client: TwitchClient): Promise<boolean> => client.init();
export { init };
