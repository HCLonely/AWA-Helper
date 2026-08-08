/** Adds free app licenses required by the selected AWA quests. */
import { ASFContext } from '../../ASFContext';
import { executeCommand } from '../commands';
export const addLicense = async (context: ASFContext, appIds: string[]): Promise<boolean> => {
  if (!appIds.length) return true;
  await executeCommand(context, `!addlicense ${context.botName} ${appIds.map((id) => `app/${id}`).join(',')}`);
  return true;
};
