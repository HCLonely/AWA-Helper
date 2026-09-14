/**
 * @file src/client/AWA/APIs/quests/getControlCenter.ts
 * @description 获取 AWA 控制中心原始 HTML，供解析器提取任务状态。
 */
import { AWAContext } from '../../AWAContext';
/**
 * 获取 get Control Center 相关数据。
 * @param context - 发起远程请求及保存会话状态所需的客户端上下文，类型为 `AWAContext`。
 * @returns `Promise<string>`，getControlCenter 获取或生成的文本内容。
 */
export const getControlCenter = async (context: AWAContext): Promise<string> => {
  const options: myAxiosConfig = {
    url: `${context.baseURL}/control-center`, method: 'GET', headers: {
      ...context.headers,
      accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7'
    }
  };
  if (context.httpsAgent) {
    options.httpsAgent = context.httpsAgent;
  }
  let response = await context.request(options);

  // A stale PHP session/sc pair can authenticate the account while losing its
  // login record. Renew both together through REMEMBERME, once per fetch.
  const html = String(response.data);
  const rememberMe = context.cookie.get('REMEMBERME');
  if (rememberMe && rememberMe !== 'deleted' &&
    /\b(?:var|let|const)\s+login_id\s*=\s*null\s*;/.test(html) &&
    /\bconsecutive_logins\s*=\s*\{\s*"count"\s*:\s*0\s*\}/.test(html)) {
    context.cookie.remove('PHPSESSID').remove('sc');
    context.headers.cookie = context.cookie.stringify();
    response = await context.request(options);
  }

  context.updateCookies(response.headers?.['set-cookie']);
  return String(response.data);
};
