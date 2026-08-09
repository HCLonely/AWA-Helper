/**
 * @file src/client/Steam/APIs/bot/playGames.ts
 * @description 通过 ASF 启动指定 Steam 应用的挂时。
 */
import { ASFContext } from '../../ASFContext';
import { executeCommand } from '../commands';
/**
 * 处理 play Games 相关逻辑。
 * @param context - 发起远程请求及保存会话状态所需的客户端上下文，类型为 `ASFContext`。
 * @param appIds - 需要处理的 Steam 应用标识列表，类型为 `string[]`。
 * @returns `Promise<boolean>`，表示 playGames 检查是否通过。
 */
export const playGames = async (context: ASFContext, appIds: string[]): Promise<boolean> => {
  if (!appIds.length) return false;
  await executeCommand(context, `!play ${context.botName} ${appIds.join(',')}`);
  return true;
};
