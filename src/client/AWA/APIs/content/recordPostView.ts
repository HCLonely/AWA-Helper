/**
 * @file src/client/AWA/APIs/content/recordPostView.ts
 * @description 向 AWA 提交一次论坛帖子浏览任务记录。
 */
import { AWAContext } from '../../AWAContext';
/**
 * 处理 record Post View 相关逻辑。
 * @param context - 发起远程请求及保存会话状态所需的客户端上下文，类型为 `AWAContext`。
 * @param postId - 目标资源的唯一标识，类型为 `string`。
 * @returns `Promise<boolean>`，表示 recordPostView 检查是否通过。
 */
export const recordPostView = async (context: AWAContext, postId: string): Promise<boolean> => {
  const link = `${context.baseURL}/ucf/show/${postId}`;
  const options: myAxiosConfig = {
    url: `${context.baseURL}/ucf/increment-views/${postId}`, method: 'POST',
    headers: { ...context.headers, origin: context.baseURL, referer: link }
  };
  if (context.httpsAgent) options.httpsAgent = context.httpsAgent;
  return (await context.request(options)).data === 'success';
};
