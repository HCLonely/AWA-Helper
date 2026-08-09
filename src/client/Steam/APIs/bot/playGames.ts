/**
 * @file src/client/Steam/APIs/bot/playGames.ts
 * @description 通过 ASF 启动指定 Steam 应用的挂时。
 */
import { ASFContext } from '../../ASFContext';
import { executeCommand } from '../commands';
import type { ActionResult } from '../../../shared';
/**
 * 处理 play Games 相关逻辑。
 * @param context - 发起远程请求及保存会话状态所需的客户端上下文，类型为 `ASFContext`。
 * @param appIds - 需要处理的 Steam 应用标识列表，类型为 `string[]`。
 * @returns 启动成功时返回 `started`；未提供游戏时返回 `no-games`。
 */
export const playGames = async (context: ASFContext, appIds: string[]): Promise<ActionResult<'started', 'no-games'>> => {
  if (!appIds.length) {
    return { ok: false, state: 'no-games' };
  }
  await executeCommand(context, `!play ${context.botName} ${appIds.join(',')}`);
  return { ok: true, state: 'started' };
};
