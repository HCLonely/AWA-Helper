/** @description Starts Twitch extension tracking until completion or cancellation. */
import type { TwitchClient } from '../TwitchClient';
const sendTrack = (client: TwitchClient, signal?: AbortSignal): Promise<boolean> => client.do(signal);
export { sendTrack };
