/** @description Initializes an AWA client session and returns its platform status code. */
import type { AWAClient } from '../AWAClient';
const init = (client: AWAClient): Promise<number> => client.init();
export { init };
