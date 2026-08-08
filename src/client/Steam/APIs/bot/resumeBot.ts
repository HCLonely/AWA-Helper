/** Returns the ASF bot to its normal farming schedule. */
import { ASFContext } from '../../ASFContext';
import { executeCommand } from '../commands';
export const resumeBot = async (context: ASFContext): Promise<boolean> => {
  await executeCommand(context, `!resume ${context.botName}`);
  return true;
};
