/** Claims one directly awardable AWA quest. */
import { http } from '../tools-path';
import { AWAContext } from '../../AWAContext';
export const claimQuestAward = async (context: AWAContext, questId: string): Promise<boolean> => {
  const options: myAxiosConfig = {
    url: `${context.baseURL}/ajax/user/quest-award/${questId}`, method: 'GET',
    headers: { ...context.headers, referer: `${context.baseURL}/` }
  };
  if (context.httpsAgent) options.httpsAgent = context.httpsAgent;
  return (await http(options)).status === 200;
};
