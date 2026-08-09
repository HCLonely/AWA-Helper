/**
 * @file src/client/AWA/APIs/quests/sendTimeOnSiteTrack.ts
 * @description 发送一次 AWA 在线时长或页面浏览跟踪请求。
 */
import { AWAContext } from '../../AWAContext';
import type { ActionResult } from '../../../shared';
/**
 * 发送 send Time On Site Track 相关数据。
 * @param context - 发起远程请求及保存会话状态所需的客户端上下文，类型为 `AWAContext`。
 * @param link - 需要访问或提交的目标页面链接，类型为 `string | undefined`。
 * @returns 上报成功时返回 `tracked`，远程拒绝时返回 `rejected`。
 */
export const sendTimeOnSiteTrack = async (context: AWAContext, link?: string): Promise<ActionResult<'tracked', 'rejected'>> => {
  const target = link || `${context.baseURL}/account/personalization`;
  const options: myAxiosConfig = {
    url: `${context.baseURL}/tos/track`, method: 'POST',
    headers: { ...context.headers, 'content-type': 'application/x-www-form-urlencoded; charset=UTF-8', origin: context.baseURL, referer: target },
    data: JSON.stringify({ url: target })
  };
  if (context.httpsAgent) options.httpsAgent = context.httpsAgent;
  const response = await context.request<{ success?: boolean }>(options);
  context.updateCookies(response.headers?.['set-cookie']);
  return link || response.data?.success === true ? { ok: true, state: 'tracked' } : { ok: false, state: 'rejected' };
};
