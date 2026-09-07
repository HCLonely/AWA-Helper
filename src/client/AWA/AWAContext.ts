/**
 * @file src/client/AWA/AWAContext.ts
 * @description 维护 AWA 基础地址、身份 Cookie、请求头和可注入 HTTP 传输状态。
 */
import type { RawAxiosRequestHeaders } from 'axios';
import { withRequestSignal } from '../../tools/http/RequestContext';
import { Cookie, http } from '../../tools';
import { observeExternalRequest, safeRequestTarget } from '../../tools/logging';
import { createHttpTransport, createProxyAgent, DEFAULT_AWA_HOST, DEFAULT_USER_AGENT, type CookieStore, type HttpTransport } from '../shared';
import { AWAError } from './AWAError';

export interface AWAContextOptions {
  cookie: string;
  host?: string;
  userAgent?: string;
  proxy?: proxy;
  transport?: HttpTransport;
  /** 是否记录真实网络请求；注入测试 transport 时默认关闭。 */
  logRequests?: boolean;
}

export class AWAContext {
  host: string;
  private readonly initialOrigin: string;
  readonly cookie: CookieStore;
  readonly headers: RawAxiosRequestHeaders;
  readonly httpsAgent?: myAxiosConfig['httpsAgent'];
  readonly transport: HttpTransport;
  readonly logRequests: boolean;
  userId?: string;
  username?: string;

  /**
   * 初始化 AWAContext 实例。
   * @param options - 创建实例或执行操作所需的配置选项，类型为 `AWAContextOptions`。
   */
  constructor(options: AWAContextOptions) {
    this.host = options.host || DEFAULT_AWA_HOST;
    if (!/^[a-z\d.-]+(?::\d+)?$/i.test(this.host)) {
      throw new AWAError('configuration', 'Invalid AWA host', false);
    }
    const initialUrl = new URL(`https://${this.host}`);
    this.host = initialUrl.host;
    this.initialOrigin = initialUrl.origin;
    this.transport = options.transport || createHttpTransport(http);
    this.logRequests = options.logRequests ?? false;
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

  assertTrustedURL(target: string): URL {
    const url = new URL(target, this.baseURL);
    const awaHost = url.hostname === 'alienwarearena.com' || url.hostname.endsWith('.alienwarearena.com');
    if (url.protocol !== 'https:' || url.username || url.password ||
      (url.origin !== this.initialOrigin && !(awaHost && !url.port))) {
      throw new AWAError('request', 'Refusing to send AWA credentials to an untrusted destination', false);
    }
    return url;
  }

  /**
   * 更新 update Cookies 相关数据。
   * @param setCookie - 用于身份验证和维持会话的 Cookie，类型为 `string[] | undefined`。
   * @returns `void`，该函数仅执行副作用，不返回值。
   */
  updateCookies(setCookie?: string[]): void {
    if (!setCookie?.length) {
      return;
    }
    this.headers.cookie = this.cookie.update(setCookie).stringify();
  }

  /**
   * 请求 request 相关数据。
   * @param options - 创建实例或执行操作所需的配置选项，类型为 `myAxiosConfig`。
   * @returns `Promise<AxiosResponse<T, any, {}, any>>`，request 请求返回的响应结果。
   */
  async request<T = unknown>(options: myAxiosConfig) {
    const target = this.assertTrustedURL(new URL(options.url || '', options.baseURL || this.baseURL).href);
    const requestOptions: myAxiosConfig = {
      ...options,
      url: target.href,
      baseURL: undefined,
      beforeRedirect: (redirectOptions) => {
        this.assertTrustedURL(`${redirectOptions.protocol}//${redirectOptions.hostname}${redirectOptions.port ? `:${redirectOptions.port}` : ''}${redirectOptions.path || '/'}`);
      },
      headers: { ...this.headers, ...options.headers, cookie: this.cookie.stringify() }
    };
    if (this.httpsAgent && !requestOptions.httpsAgent) {
      requestOptions.httpsAgent = this.httpsAgent;
    }
    try {
      const execute = () => this.transport.request<T>(withRequestSignal(requestOptions));
      const response = this.logRequests
        ? await observeExternalRequest('AWA', requestOptions, execute)
        : await execute();
      this.updateCookies(response.headers?.['set-cookie']);
      return response;
    } catch (error) {
      if (error instanceof AWAError) {
        throw error;
      }
      const statusCode = error && typeof error === 'object' && 'response' in error
        ? (error as { response?: { status?: number } }).response?.status
        : undefined;
      throw new AWAError('request', `AWA request failed: ${safeRequestTarget(options.url)}`, statusCode === undefined || statusCode >= 500, statusCode, { cause: error });
    }
  }
}
