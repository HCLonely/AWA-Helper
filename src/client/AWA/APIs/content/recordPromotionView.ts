/**
 * @file src/client/AWA/APIs/content/recordPromotionView.ts
 * @description 向 AWA 提交一次推广新闻浏览任务记录。
 */
import { AWAContext } from '../../AWAContext';
import type { ActionResult } from '../../../shared';
/**
 * 记录推广内容浏览。
 * @param context - 发起远程请求及保存会话状态所需的客户端上下文，类型为 `AWAContext`。
 * @param id - 目标资源的唯一标识，类型为 `string`。
 * @param token - 远程服务用于身份验证的凭据，类型为 `string`。
 * @returns 记录成功时返回 `recorded`，远程拒绝时返回 `rejected`。
 */
export const recordPromotionView = async (context: AWAContext, id: string, token: string): Promise<ActionResult<'recorded', 'rejected'>> => {
  const options: myAxiosConfig = {
    url: `${context.baseURL}/ajax/promo/view/${id}`,
    method: 'POST',
    headers: {
      ...context.headers,
      'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
      origin: context.baseURL
    },
    data: `token=${token}`
  };
  if (context.httpsAgent) {
    options.httpsAgent = context.httpsAgent;
  }
  return (await context.request(options)).status === 200 ? {
    ok: true,
    state: 'recorded'
  } : {
    ok: false,
    state: 'rejected'
  };
};
