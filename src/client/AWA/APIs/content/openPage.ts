/**
 * @file src/client/AWA/APIs/content/openPage.ts
 * @description 打开经过身份验证的 AWA 页面并返回原始 HTML。
 */
import { AWAContext } from '../../AWAContext';
/**
 * 打开目标页面。
 * @param context - 发起远程请求及保存会话状态所需的客户端上下文，类型为 `AWAContext`。
 * @param link - 需要访问或提交的目标页面链接，类型为 `string`。
 * @returns `Promise<string>`，openPage 获取或生成的文本内容。
 */
export const openPage = async (context: AWAContext, link: string): Promise<string> => {
  const options: myAxiosConfig = {
    url: link,
    method: 'GET',
    headers: {
      ...context.headers,
      referer: `${context.baseURL}/`
    }
  };
  if (context.httpsAgent) {
    options.httpsAgent = context.httpsAgent;
  }
  const response = await context.request(options);
  context.updateCookies(response.headers?.['set-cookie']);
  return String(response.data);
};
