/**
 * @file src/client/AWA/APIs/content/sharePost.ts
 * @description 向 AWA 提交一次论坛帖子分享任务记录。
 */
import { AWAContext } from '../../AWAContext';
import type { ActionResult } from '../../../shared';
/**
 * 分享帖子。
 * @param context - 发起远程请求及保存会话状态所需的客户端上下文，类型为 `AWAContext`。
 * @param postId - 目标资源的唯一标识，类型为 `string`。
 * @returns 分享成功时返回 `shared`，远程拒绝时返回 `rejected`。
 */
export const sharePost = async (context: AWAContext, postId: string): Promise<ActionResult<'shared', 'rejected'>> => {
  const options: myAxiosConfig = {
    url: `${context.baseURL}/arp/quests/share/${postId}`,
    method: 'POST',
    responseType: 'json',
    headers: {
      ...context.headers,
      origin: context.baseURL,
      referer: `${context.baseURL}/ucf/show/${postId}`
    }
  };
  if (context.httpsAgent) {
    options.httpsAgent = context.httpsAgent;
  }
  const response = await context.request(options);
  return response.status === 200 && Object.keys(response.data || {}).length === 0
    ? {
      ok: true,
      state: 'shared'
    }
    : {
      ok: false,
      state: 'rejected'
    };
};
