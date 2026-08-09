/** Returns the current ASF bot status text without interpreting task policy. */
import { ASFContext } from '../../ASFContext';
import { executeCommand } from '../commands';

export const getStatus = (context: ASFContext): Promise<string> => executeCommand(context, `!status ${context.botName}`);
