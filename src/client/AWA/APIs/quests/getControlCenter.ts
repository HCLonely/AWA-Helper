/** Fetches raw control-center HTML; parsers and Core decide which task data is needed. */
import { http } from '../tools-path';
import { AWAContext } from '../../AWAContext';
export const getControlCenter = async (context: AWAContext): Promise<string> => {
  const options: myAxiosConfig = { url: `${context.baseURL}/control-center`, method: 'GET', headers: context.headers };
  if (context.httpsAgent) options.httpsAgent = context.httpsAgent;
  const response = await http(options);
  context.updateCookies(response.headers?.['set-cookie']);
  return String(response.data);
};
