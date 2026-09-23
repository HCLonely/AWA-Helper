/**
 * @file src/client/Steam/APIs/bot/getOwnedGames.ts
 * @description 通过 ASF 查询账户拥有的 Steam 应用标识。
 */
import { ASFContext } from '../../ASFContext';
import { executeCommand } from '../commands';

/**
 * 获取已拥有的游戏。
 * @param context - 发起远程请求及保存会话状态所需的客户端上下文，类型为 `ASFContext`。
 * @param appIds - 需要处理的 Steam 应用标识列表，类型为 `string[]`。
 * @returns `Promise<string[]>`，getOwnedGames 收集或筛选得到的数据列表。
 */
export const getOwnedGames = async (context: ASFContext, appIds: string[]): Promise<string[]> => {
  if (!appIds.length) {
    return [];
  }
  const result = await executeCommand(context, `!owns ${context.botName} ${appIds.join(',')}`);
  return [...new Set(result.split('\n').flatMap((line) => line.match(/app\/([\d]+)/)?.[1] || []))];
};
