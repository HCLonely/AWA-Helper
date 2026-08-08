/** Saves a complete AWA avatar configuration. */
import { http } from '../tools-path';
import { AWAContext } from '../../AWAContext';
import { AWAError } from '../../AWAError';
import type { userAvatarInfo } from '../../../../types/achievement';

export const saveAvatar = async (context: AWAContext, avatar: userAvatarInfo): Promise<boolean> => {
  if (!context.userId) throw new AWAError('saveAvatar', 'AWA user id is not initialized');
  const options: myAxiosConfig = {
    url: `${context.baseURL}/ajax/user/avatar/save/${context.userId}`, method: 'POST',
    headers: { ...context.headers, 'content-type': 'application/json', origin: context.baseURL, referer: `${context.baseURL}/account/personalization` },
    data: avatar
  };
  if (context.httpsAgent) options.httpsAgent = context.httpsAgent;
  const response = await http(options);
  return response.data?.success === true;
};
