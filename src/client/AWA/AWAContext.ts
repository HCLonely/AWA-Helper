/**
 * @file src/client/AWA/AWAContext.ts
 * @description 维护 AWA 基础地址、身份 Cookie、请求头和可注入 HTTP 传输状态。
 */
import type { RawAxiosRequestHeaders } from 'axios';
import { Cookie, http } from '../../tools';
import { createHttpTransport, createProxyAgent, DEFAULT_AWA_HOST, DEFAULT_USER_AGENT, type CookieStore, type HttpTransport } from '../shared';
import { AWAError } from './AWAError';

export interface AWAContextOptions {
  cookie: string;
  host?: string;
  userAgent?: string;
  proxy?: proxy;
  transport?: HttpTransport;
}

export class AWAContext {
  host: string;
  readonly cookie: CookieStore;
  readonly headers: RawAxiosRequestHeaders;
  readonly httpsAgent?: myAxiosConfig['httpsAgent'];
  readonly transport: HttpTransport;
  userId?: string;
  username?: string;

  /**
   * 初始化 AWAContext 实例。
   * @param options - 创建实例或执行操作所需的配置选项，类型为 `AWAContextOptions`。
   */
  constructor(options: AWAContextOptions) {
    this.host = options.host || DEFAULT_AWA_HOST;
    this.transport = options.transport || createHttpTransport(http);
    this.cookie = new Cookie(options.cookie);
    this.headers = {
      cookie: this.cookie.stringify(),
      'user-agent': options.userAgent || DEFAULT_USER_AGENT,
      'accept-encoding': 'gzip, deflate, br',
      'accept-language': 'zh-CN,zh;q=0.9,en;q=0.8,en-GB;q=0.7,en-US;q=0.6'
    };
    if (options.proxy?.enable?.includes('awa') && options.proxy.host && options.proxy.port) {
      this.httpsAgent = createProxyAgent(options.proxy);
    }
  }

  /**
   * 获取 base URL。
   * @returns `string`，baseURL 获取或生成的文本内容。
   */
  get baseURL(): string {
    return `https://${this.host}`;
  }

  /**
   * 更新 update Cookies 相关数据。
   * @param setCookie - 用于身份验证和维持会话的 Cookie，类型为 `string[] | undefined`。
   * @returns `void`，该函数仅执行副作用，不返回值。
   */
  updateCookies(setCookie?: string[]): void {
    if (!setCookie?.length) return;
    this.headers.cookie = this.cookie.update(setCookie).stringify();
  }

  /**
   * 请求 request 相关数据。
   * @param options - 创建实例或执行操作所需的配置选项，类型为 `myAxiosConfig`。
   * @returns `Promise<AxiosResponse<T, any, {}, any>>`，request 请求返回的响应结果。
   */
  async request<T = unknown>(options: myAxiosConfig) {
    const requestOptions: myAxiosConfig = {
      ...options,
      headers: { ...this.headers, ...options.headers, cookie: this.cookie.stringify() }
    };
    if (this.httpsAgent && !requestOptions.httpsAgent) requestOptions.httpsAgent = this.httpsAgent;
    try {
      const response = await this.transport.request<T>(requestOptions);
      this.updateCookies(response.headers?.['set-cookie']);
      return response;
    } catch (error) {
      if (error instanceof AWAError) throw error;
      const statusCode = error && typeof error === 'object' && 'response' in error
        ? (error as { response?: { status?: number } }).response?.status
        : undefined;
      throw new AWAError('request', `AWA request failed: ${String(options.url)}`, statusCode === undefined || statusCode >= 500, statusCode, { cause: error });
    }
  }
}
