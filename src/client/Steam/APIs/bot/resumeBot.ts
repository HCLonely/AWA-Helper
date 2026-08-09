/**
 * @file src/client/Steam/APIs/bot/resumeBot.ts
 * @description 让 ASF 机器人恢复正常的卡牌掉落挂时计划。
 */
import { ASFContext } from '../../ASFContext';
import { executeCommand } from '../commands';
import type { ActionResult } from '../../../shared';
/**
 * 处理 resume Bot 相关逻辑。
 * @param context - 发起远程请求及保存会话状态所需的客户端上下文，类型为 `ASFContext`。
 * @returns ASF Bot 恢复成功后的 `resumed` 结果。
 */
export const resumeBot = async (context: ASFContext): Promise<ActionResult<'resumed'>> => {
  await executeCommand(context, `!resume ${context.botName}`);
  return { ok: true, state: 'resumed' };
};
