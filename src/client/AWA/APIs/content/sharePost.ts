/** Records one AWA forum share quest action. */
import { http } from '../tools-path';
import { AWAContext } from '../../AWAContext';
export const sharePost = async (context: AWAContext, postId: string): Promise<boolean> => {
  const options: myAxiosConfig = {
    url: `${context.baseURL}/arp/quests/share/${postId}`, method: 'POST', responseType: 'json',
    headers: { ...context.headers, origin: context.baseURL, referer: `${context.baseURL}/ucf/show/${postId}` }
  };
  if (context.httpsAgent) options.httpsAgent = context.httpsAgent;
  const response = await http(options);
  return response.status === 200 && Object.keys(response.data || {}).length === 0;
};
