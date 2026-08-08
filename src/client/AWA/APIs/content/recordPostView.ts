/** Records one forum post view. */
import { http } from '../tools-path';
import { AWAContext } from '../../AWAContext';
export const recordPostView = async (context: AWAContext, postId: string): Promise<boolean> => {
  const link = `${context.baseURL}/ucf/show/${postId}`;
  const options: myAxiosConfig = {
    url: `${context.baseURL}/ucf/increment-views/${postId}`, method: 'POST',
    headers: { ...context.headers, origin: context.baseURL, referer: link }
  };
  if (context.httpsAgent) options.httpsAgent = context.httpsAgent;
  return (await http(options)).data === 'success';
};
