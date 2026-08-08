/** Opens an authenticated AWA page and returns its HTML. */
import { http } from '../tools-path';
import { AWAContext } from '../../AWAContext';
export const openPage = async (context: AWAContext, link: string): Promise<string> => {
  const options: myAxiosConfig = { url: link, method: 'GET', headers: { ...context.headers, referer: `${context.baseURL}/` } };
  if (context.httpsAgent) options.httpsAgent = context.httpsAgent;
  const response = await http(options);
  context.updateCookies(response.headers?.['set-cookie']);
  return String(response.data);
};
