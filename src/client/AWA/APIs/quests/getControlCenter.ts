/**
 * @file src/client/AWA/APIs/quests/getControlCenter.ts
 * @description 获取 AWA 控制中心原始 HTML，供解析器提取任务状态。
 */
import { AWAContext } from '../../AWAContext';
import { SharedRead } from '../../../../tools/http/SharedRead';
import { getRequestSignal } from '../../../../tools/http/RequestContext';

const reads = new WeakMap<AWAContext, {
  read: SharedRead<string>;
  origin: string;
  revision: number
}>();
/**
 * 获取控制中心页面。
 * @param context - 发起远程请求及保存会话状态所需的客户端上下文，类型为 `AWAContext`。
 * @returns `Promise<string>`，getControlCenter 获取或生成的文本内容。
 */
const fetchControlCenter = async (context: AWAContext, signal: AbortSignal): Promise<string> => {
  const deadlineSignal = AbortSignal.any([signal, AbortSignal.timeout(45000)]);
  const options: myAxiosConfig = {
    url: `${context.baseURL}/control-center`,
    method: 'GET',
    signal: deadlineSignal,
    timeout: 15000,
    retryTimes: 1,
    headers: {
      ...context.headers,
      accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7'
    }
  };
  if (context.httpsAgent) {
    options.httpsAgent = context.httpsAgent;
  }
  let response = await context.request(options);

  // 过期的 PHP 会话与 sc 组合可能仍能验证账户，却丢失
  // 登录记录。通过 REMEMBERME 一并更新两者，每次获取最多重试一次。
  const html = String(response.data);
  const rememberMe = context.cookie.get('REMEMBERME');
  if (rememberMe && rememberMe !== 'deleted' &&
    /\b(?:var|let|const)\s+login_id\s*=\s*null\s*;/.test(html) &&
    /\bconsecutive_logins\s*=\s*\{\s*"count"\s*:\s*0\s*\}/.test(html)) {
    context.cookie.remove('PHPSESSID').remove('sc');
    context.headers.cookie = context.cookie.stringify();
    response = await context.request(options);
  }

  return String(response.data);
};

export const getControlCenter = (context: AWAContext): Promise<string> => {
  let entry = reads.get(context);
  if (!entry || entry.origin !== context.baseURL || entry.revision !== context.readRevision) {
    entry = {
      read: new SharedRead<string>(),
      origin: context.baseURL,
      revision: context.readRevision
    };
    reads.set(context, entry);
  }
  return entry.read.get((signal) => fetchControlCenter(context, signal), getRequestSignal());
};
