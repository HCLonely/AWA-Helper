/** @description Refreshes and validates the current AWA cookie. */
import type { AWAClient } from '../AWAClient';
const updateCookie = (client: AWAClient): Promise<boolean> => client.updateCookie();
export { updateCookie };
