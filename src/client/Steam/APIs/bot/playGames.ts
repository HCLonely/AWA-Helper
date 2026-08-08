/** Starts idling the supplied apps through ASF. */
import { ASFContext } from '../../ASFContext';
import { executeCommand } from '../commands';
export const playGames = async (context: ASFContext, appIds: string[]): Promise<boolean> => {
  if (!appIds.length) return false;
  await executeCommand(context, `!play ${context.botName} ${appIds.join(',')}`);
  return true;
};
