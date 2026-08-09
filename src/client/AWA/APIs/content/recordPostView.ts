/**
 * @file src/client/AWA/APIs/content/recordPostView.ts
 * @description 向 AWA 提交一次论坛帖子浏览任务记录。
 */
import { AWAContext } from '../../AWAContext';
import type { ActionResult } from '../../../shared';
/**
 * 处理 record Post View 相关逻辑。
 * @param context - 发起远程请求及保存会话状态所需的客户端上下文，类型为 `AWAContext`。
 * @param postId - 目标资源的唯一标识，类型为 `string`。
 * @returns 记录成功时返回 `recorded`，远程拒绝时返回 `rejected`。
 */
export const recordPostView = async (context: AWAContext, postId: string): Promise<ActionResult<'recorded', 'rejected'>> => {
  const link = `${context.baseURL}/ucf/show/${postId}`;
  const options: myAxiosConfig = {
    url: `${context.baseURL}/ucf/increment-views/${postId}`, method: 'POST',
    headers: { ...context.headers, origin: context.baseURL, referer: link }
  };
  if (context.httpsAgent) options.httpsAgent = context.httpsAgent;
  return (await context.request(options)).data === 'success' ? { ok: true, state: 'recorded' } : { ok: false, state: 'rejected' };
};
