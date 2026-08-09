/** Reads the additional Twitch ARP bonus provided by equipped artifacts. */
import { AWAContext } from '../../AWAContext';
import { parseTwitchArtifactBonus } from '../../parsers';

export const getTwitchBonus = async (context: AWAContext, userProfilePath: string): Promise<number> => {
  const options: myAxiosConfig = {
    url: `${context.baseURL}${userProfilePath}/artifacts`, method: 'GET',
    headers: { ...context.headers, referer: context.baseURL }
  };
  if (context.httpsAgent) options.httpsAgent = context.httpsAgent;
  const response = await context.request<string>(options);
  return parseTwitchArtifactBonus(response.data);
};
