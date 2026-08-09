/** Refreshes the AWA session cookie and follows the configured home-site redirect. */
import { AWAContext } from '../../AWAContext';
import { AWAError } from '../../AWAError';

export const refreshSession = async (context: AWAContext): Promise<string> => {
  const options: myAxiosConfig = {
    url: `${context.baseURL}/`, method: 'GET', headers: { ...context.headers, cookie: context.cookie.stringify() },
    maxRedirects: 0, validateStatus: (status) => status === 200 || status === 302
  };
  if (context.httpsAgent) options.httpsAgent = context.httpsAgent;
  try {
    const response = await context.request(options);
    if (typeof response.data === 'string' && response.data.toLowerCase().includes('we have detected an issue with your network')) {
      throw new AWAError('refreshSession', 'AWA rejected the current network address', false, 610);
    }
    context.updateCookies(response.headers['set-cookie']);
    const homeSite = context.cookie.get('home_site');
    if (response.status === 302 && homeSite && homeSite !== context.host) {
      context.host = homeSite;
      return refreshSession(context);
    }
    if (context.cookie.get('REMEMBERME') === 'deleted') {
      throw new AWAError('refreshSession', 'AWA cookie has expired', false, 602);
    }
    return context.cookie.stringify();
  } catch (error) {
    if (error instanceof AWAError) throw error;
    throw new AWAError('refreshSession', 'Unable to refresh AWA session', true, undefined, { cause: error });
  }
};
