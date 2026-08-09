/**
 * @file src/client/Steam/APIs/session/verifyConnection.ts
 * @description 验证 ASF IPC 地址、密码和服务可用性。
 */
import { ASFContext } from '../../ASFContext';
import { executeCommand } from '../commands';

/**
 * 检查 verify Connection 相关数据。
 * @param context - 发起远程请求及保存会话状态所需的客户端上下文，类型为 `ASFContext`。
 * @returns `Promise<boolean>`，表示 verifyConnection 检查是否通过。
 */
export const verifyConnection = async (context: ASFContext): Promise<boolean> => {
  try { return (await executeCommand(context, '!stats')).length > 0; } catch (_error) { return false; }
};
