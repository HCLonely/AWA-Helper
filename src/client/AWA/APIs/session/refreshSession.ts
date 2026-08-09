/**
 * @file src/client/AWA/APIs/session/refreshSession.ts
 * @description 刷新 AWA 会话 Cookie，并跟随配置的主页重定向。
 */
import { AWAContext } from '../../AWAContext';
import { AWAError } from '../../AWAError';

/**
 * 更新 refresh Session 相关数据。
 * @param context - 发起远程请求及保存会话状态所需的客户端上下文，类型为 `AWAContext`。
 * @returns `Promise<string>`，refreshSession 获取或生成的文本内容。
 */
export const refreshSession = async (context: AWAContext): Promise<string> => {
  const options: myAxiosConfig = {
    url: `${context.baseURL}/`, method: 'GET', headers: { ...context.headers, cookie: context.cookie.stringify() },
    maxRedirects: 0,
    /**
     * 检查 validate Status 相关数据。
     * @param status - 当前对象或任务的状态，类型为 `number`。
     * @returns `boolean`，表示 validateStatus 检查是否通过。
     */
    validateStatus: (status) => status === 200 || status === 302
  };
  if (context.httpsAgent) {
    options.httpsAgent = context.httpsAgent;
  }
  try {
    const response = await context.request(options);
    if (typeof response.data === 'string' && response.data.toLowerCase().includes('we have detected an issue with your network')) {
      throw new AWAError('refreshSession', 'AWA rejected the current network address', false, 610);
    }
    context.updateCookies(response.headers['set-cookie']);
    const homeSite = context.cookie.get('home_site');
    if (response.status === 302 && homeSite && homeSite !== context.host) {
      context.host = homeSite;
      return refreshSession(context);
    }
    if (context.cookie.get('REMEMBERME') === 'deleted') {
      throw new AWAError('refreshSession', 'AWA cookie has expired', false, 602);
    }
    return context.cookie.stringify();
  } catch (error) {
    if (error instanceof AWAError) {
      throw error;
    }
    throw new AWAError('refreshSession', 'Unable to refresh AWA session', true, undefined, { cause: error });
  }
};
