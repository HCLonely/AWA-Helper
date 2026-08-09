/** Completes one Get Started item; iteration order belongs to Core. */
import { AWAContext } from '../../AWAContext';
export const completeGetStartedItem = async (context: AWAContext, link: string): Promise<boolean> => {
  const options: myAxiosConfig = {
    url: new URL(link, `${context.baseURL}/`).href, method: 'GET',
    headers: { ...context.headers, origin: context.baseURL, referer: `${context.baseURL}/control-center` }
  };
  if (context.httpsAgent) options.httpsAgent = context.httpsAgent;
  return (await context.request(options)).status === 200;
};
