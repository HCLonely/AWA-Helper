/** Queries ASF and extracts owned Steam app ids. */
import { ASFContext } from '../../ASFContext';
import { executeCommand } from '../commands';

export const getOwnedGames = async (context: ASFContext, appIds: string[]): Promise<string[]> => {
  if (!appIds.length) return [];
  const result = await executeCommand(context, `!owns ${context.botName} ${appIds.join(',')}`);
  return [...new Set(result.split('\n').flatMap((line) => line.match(/app\/([\d]+)/)?.[1] || []))];
};
