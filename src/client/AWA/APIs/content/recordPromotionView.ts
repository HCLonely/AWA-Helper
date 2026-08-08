/** Records one promotional news view. */
import { http } from '../tools-path';
import { AWAContext } from '../../AWAContext';
export const recordPromotionView = async (context: AWAContext, id: string, token: string): Promise<boolean> => {
  const options: myAxiosConfig = {
    url: `${context.baseURL}/ajax/promo/view/${id}`, method: 'POST',
    headers: { ...context.headers, 'content-type': 'application/x-www-form-urlencoded; charset=UTF-8', origin: context.baseURL }, data: `token=${token}`
  };
  if (context.httpsAgent) options.httpsAgent = context.httpsAgent;
  return (await http(options)).status === 200;
};
