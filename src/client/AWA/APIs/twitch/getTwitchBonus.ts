/** Reads the additional Twitch ARP bonus provided by equipped artifacts. */
import { load } from 'cheerio';
import { http } from '../tools-path';
import { AWAContext } from '../../AWAContext';

export const getTwitchBonus = async (context: AWAContext, userProfilePath: string): Promise<number> => {
  const options: myAxiosConfig = {
    url: `${context.baseURL}${userProfilePath}/artifacts`, method: 'GET',
    headers: { ...context.headers, referer: context.baseURL }
  };
  if (context.httpsAgent) options.httpsAgent = context.httpsAgent;
  const response = await http(options);
  const $ = load(response.data);
  return $('.artifact-card-chaotic').toArray().reduce((total, card) => {
    if (!$(card).find('button[onClick]').length) return total;
    return total + parseFloat($(card).find('a[data-description-perk]').attr('data-description-perk')
      ?.match(/Twitch quests by ([\d]+)/)?.[1] || '0');
  }, 0);
};
