/**
 * @file src/client/Steam/APIs/session/getStatus.ts
 * @description 读取 ASF 机器人当前状态文本，不附加任务策略判断。
 */
import { ASFContext } from '../../ASFContext';
import { executeCommand } from '../commands';

/**
 * 获取运行状态。
 * @param context - 发起远程请求及保存会话状态所需的客户端上下文，类型为 `ASFContext`。
 * @returns `Promise<string>`，getStatus 获取或生成的文本内容。
 */
export const getStatus = (context: ASFContext): Promise<string> => executeCommand(context, `!status ${context.botName}`);
