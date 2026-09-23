/**
 * @file src/client/Steam/APIs/session/verifyConnection.ts
 * @description 验证 ASF IPC 地址、密码和服务可用性。
 */
import { ASFContext } from '../../ASFContext';
import { executeCommand } from '../commands';
import type { ActionResult } from '../../../shared';

/**
 * 验证连接。
 * @param context - 发起远程请求及保存会话状态所需的客户端上下文，类型为 `ASFContext`。
 * @returns ASF 返回状态时为 `connected`，空响应时为 `empty-response`；连接异常直接抛出 `ASFError`。
 */
export const verifyConnection = async (context: ASFContext): Promise<ActionResult<'connected', 'empty-response'>> => {
  const output = await executeCommand(context, '!stats');
  return output.length > 0 ? {
    ok: true,
    state: 'connected'
  } : {
    ok: false,
    state: 'empty-response'
  };
};
