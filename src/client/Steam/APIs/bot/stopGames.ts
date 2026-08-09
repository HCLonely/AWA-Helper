/** Stops task-specific idling by returning the ASF bot to normal farming. */
import { ASFContext } from '../../ASFContext';
import { resumeBot } from './resumeBot';

export const stopGames = (context: ASFContext): Promise<boolean> => resumeBot(context);
