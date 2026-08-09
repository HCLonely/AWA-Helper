/**
 * @file src/client/AWA/APIs/quests/completeGetStartedItem.ts
 * @description 提交一个 AWA 入门清单项目的完成请求。
 */
import { AWAContext } from '../../AWAContext';
/**
 * 完成 complete Get Started Item 相关数据。
 * @param context - 发起远程请求及保存会话状态所需的客户端上下文，类型为 `AWAContext`。
 * @param link - 需要访问或提交的目标页面链接，类型为 `string`。
 * @returns `Promise<boolean>`，表示 completeGetStartedItem 检查是否通过。
 */
export const completeGetStartedItem = async (context: AWAContext, link: string): Promise<boolean> => {
  const options: myAxiosConfig = {
    url: new URL(link, `${context.baseURL}/`).href, method: 'GET',
    headers: { ...context.headers, origin: context.baseURL, referer: `${context.baseURL}/control-center` }
  };
  if (context.httpsAgent) options.httpsAgent = context.httpsAgent;
  return (await context.request(options)).status === 200;
};
