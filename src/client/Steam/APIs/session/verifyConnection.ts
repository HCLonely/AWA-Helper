/** Verifies ASF IPC authentication and availability. */
import { ASFContext } from '../../ASFContext';
import { executeCommand } from '../commands';

export const verifyConnection = async (context: ASFContext): Promise<boolean> => {
  try { return (await executeCommand(context, '!stats')).length > 0; } catch (_error) { return false; }
};
