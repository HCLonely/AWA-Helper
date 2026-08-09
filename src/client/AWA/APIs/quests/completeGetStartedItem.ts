/**
 * @file src/client/AWA/APIs/quests/completeGetStartedItem.ts
 * @description 提交一个 AWA 入门清单项目的完成请求。
 */
import { AWAContext } from '../../AWAContext';
import type { ActionResult } from '../../../shared';
/**
 * 完成 complete Get Started Item 相关数据。
 * @param context - 发起远程请求及保存会话状态所需的客户端上下文，类型为 `AWAContext`。
 * @param link - 需要访问或提交的目标页面链接，类型为 `string`。
 * @returns 提交成功时返回 `completed`，远程拒绝时返回 `rejected`。
 */
export const completeGetStartedItem = async (context: AWAContext, link: string): Promise<ActionResult<'completed', 'rejected'>> => {
  const options: myAxiosConfig = {
    url: new URL(link, `${context.baseURL}/`).href, method: 'GET',
    headers: { ...context.headers, origin: context.baseURL, referer: `${context.baseURL}/control-center` }
  };
  if (context.httpsAgent) {
    options.httpsAgent = context.httpsAgent;
  }
  return (await context.request(options)).status === 200 ? { ok: true, state: 'completed' } : { ok: false, state: 'rejected' };
};
