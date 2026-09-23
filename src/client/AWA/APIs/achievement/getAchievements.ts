/**
 * @file src/client/AWA/APIs/achievement/getAchievements.ts
 * @description 请求并解析当前 AWA 账户的成就收藏数据。
 */
import { AWAContext } from '../../AWAContext';
import { AWAError } from '../../AWAError';
import type { Achievement } from '../../../../types/achievement';
import { parseAchievements } from '../../parsers';

/**
 * 获取成就列表。
 * @param context - 发起远程请求及保存会话状态所需的客户端上下文，类型为 `AWAContext`。
 * @returns `Promise<Achievement[]>`，getAchievements 收集或筛选得到的数据列表。
 */
export const getAchievements = async (context: AWAContext): Promise<Achievement[]> => {
  if (!context.username) {
    throw new AWAError('getAchievements', 'AWA username is not initialized');
  }
  const options: myAxiosConfig = {
    url: `${context.baseURL}/member/${context.username}/achievements`,
    method: 'GET',
    headers: context.headers
  };
  if (context.httpsAgent) {
    options.httpsAgent = context.httpsAgent;
  }
  const response = await context.request<string>(options);
  return parseAchievements(response.data);
};
