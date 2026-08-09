/**
 * @file src/client/Steam/APIs/licenses/addLicense.ts
 * @description 通过 ASF 添加 Steam 任务所需的免费应用许可证。
 */
import { ASFContext } from '../../ASFContext';
import { executeCommand } from '../commands';
/**
 * 添加 add License 相关数据。
 * @param context - 发起远程请求及保存会话状态所需的客户端上下文，类型为 `ASFContext`。
 * @param appIds - 需要处理的 Steam 应用标识列表，类型为 `string[]`。
 * @returns `Promise<boolean>`，表示 addLicense 检查是否通过。
 */
export const addLicense = async (context: ASFContext, appIds: string[]): Promise<boolean> => {
  if (!appIds.length) return true;
  await executeCommand(context, `!addlicense ${context.botName} ${appIds.map((id) => `app/${id}`).join(',')}`);
  return true;
};
