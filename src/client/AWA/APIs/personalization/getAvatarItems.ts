/** Parses available avatar or border items and the currently equipped avatar. */
import { AWAContext } from '../../AWAContext';
import type { avatarIds } from '../../../../types/achievement';
import { parsePersonalization } from '../../parsers';

export const getAvatarItems = async (context: AWAContext, type: 'avatar' | 'border'): Promise<avatarIds | null> => {
  const options: myAxiosConfig = { url: `${context.baseURL}/account/personalization`, method: 'GET', headers: context.headers };
  if (context.httpsAgent) options.httpsAgent = context.httpsAgent;
  const response = await context.request<string>(options);
  const { userId, selection } = parsePersonalization(response.data, type);
  if (userId) context.userId = userId;
  return selection;
};
