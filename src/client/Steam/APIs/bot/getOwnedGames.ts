/**
 * @file src/client/Steam/APIs/bot/getOwnedGames.ts
 * @description 通过 ASF 查询账户拥有的 Steam 应用标识。
 */
import { ASFContext } from '../../ASFContext';
import { ASFError } from '../../ASFError';
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
  const requestedIds = new Set(appIds);
  const checkedIds = new Set<string>();
  const ownedIds = new Set<string>();
  for (const line of result.split(/\r?\n/)) {
    // 只读取机器人回复的明确状态，避免把未拥有、汇总或游戏名称中的 app/ID 当成拥有记录。
    const status = line.match(/^\s*<[^>]+>\s*(Owned already|Not owned yet|已拥有|尚未拥有|已擁有|未擁有)\s*[:：]\s*app\/(\d+)(?=\s|$)/i);
    if (!status || !requestedIds.has(status[2])) {
      continue;
    }
    checkedIds.add(status[2]);
    if (/^(?:Owned already|已拥有|已擁有)$/i.test(status[1])) {
      ownedIds.add(status[2]);
    }
  }
  // IPC 成功并不代表拥有状态查询成功；缺少明确状态时不能把游戏当作未拥有并跳过。
  if (appIds.some((id) => !checkedIds.has(id))) {
    throw new ASFError('getOwnedGames', 'ASF did not return a recognized ownership status for every requested game', false);
  }
  const games = [...ownedIds];
  return games;
};
