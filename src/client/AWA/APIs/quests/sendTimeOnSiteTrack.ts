/** Sends one AWA time-on-site or page-view tracking request. */
import { http } from '../tools-path';
import { AWAContext } from '../../AWAContext';
export const sendTimeOnSiteTrack = async (context: AWAContext, link?: string): Promise<boolean> => {
  const target = link || `${context.baseURL}/account/personalization`;
  const options: myAxiosConfig = {
    url: `${context.baseURL}/tos/track`, method: 'POST',
    headers: { ...context.headers, 'content-type': 'application/x-www-form-urlencoded; charset=UTF-8', origin: context.baseURL, referer: target },
    data: JSON.stringify({ url: target })
  };
  if (context.httpsAgent) options.httpsAgent = context.httpsAgent;
  const response = await http(options);
  context.updateCookies(response.headers?.['set-cookie']);
  return link ? true : response.data?.success === true;
};
