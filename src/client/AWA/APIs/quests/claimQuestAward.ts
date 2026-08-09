/**
 * @file src/client/AWA/APIs/quests/claimQuestAward.ts
 * @description 领取一个可直接结算的 AWA 每日任务奖励。
 */
import { AWAContext } from '../../AWAContext';
import type { ActionResult } from '../../../shared';
/**
 * 完成 claim Quest Award 相关数据。
 * @param context - 发起远程请求及保存会话状态所需的客户端上下文，类型为 `AWAContext`。
 * @param questId - 目标资源的唯一标识，类型为 `string`。
 * @returns 领取成功时返回 `claimed`，远程拒绝时返回 `rejected`。
 */
export const claimQuestAward = async (context: AWAContext, questId: string): Promise<ActionResult<'claimed', 'rejected'>> => {
  const options: myAxiosConfig = {
    url: `${context.baseURL}/ajax/user/quest-award/${questId}`, method: 'GET',
    headers: { ...context.headers, referer: `${context.baseURL}/` }
  };
  if (context.httpsAgent) options.httpsAgent = context.httpsAgent;
  return (await context.request(options)).status === 200 ? { ok: true, state: 'claimed' } : { ok: false, state: 'rejected' };
};
