/**
 * @file src/client/AWA/APIs/content/sharePost.ts
 * @description 向 AWA 提交一次论坛帖子分享任务记录。
 */
import { AWAContext } from '../../AWAContext';
/**
 * 处理 share Post 相关逻辑。
 * @param context - 发起远程请求及保存会话状态所需的客户端上下文，类型为 `AWAContext`。
 * @param postId - 目标资源的唯一标识，类型为 `string`。
 * @returns `Promise<boolean>`，表示 sharePost 检查是否通过。
 */
export const sharePost = async (context: AWAContext, postId: string): Promise<boolean> => {
  const options: myAxiosConfig = {
    url: `${context.baseURL}/arp/quests/share/${postId}`, method: 'POST', responseType: 'json',
    headers: { ...context.headers, origin: context.baseURL, referer: `${context.baseURL}/ucf/show/${postId}` }
  };
  if (context.httpsAgent) options.httpsAgent = context.httpsAgent;
  const response = await context.request(options);
  return response.status === 200 && Object.keys(response.data || {}).length === 0;
};
