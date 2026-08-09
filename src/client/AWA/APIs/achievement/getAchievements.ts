/** Reads and parses achievements for the current AWA account. */
import { AWAContext } from '../../AWAContext';
import { AWAError } from '../../AWAError';
import type { Achievement } from '../../../../types/achievement';
import { parseAchievements } from '../../parsers';

export const getAchievements = async (context: AWAContext): Promise<Achievement[]> => {
  if (!context.username) throw new AWAError('getAchievements', 'AWA username is not initialized');
  const options: myAxiosConfig = { url: `${context.baseURL}/member/${context.username}/achievements`, method: 'GET', headers: context.headers };
  if (context.httpsAgent) options.httpsAgent = context.httpsAgent;
  const response = await context.request<string>(options);
  return parseAchievements(response.data);
};
