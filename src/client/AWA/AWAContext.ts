/** Mutable AWA session state shared by the small AWA API modules. */
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

  get baseURL(): string {
    return `https://${this.host}`;
  }

  updateCookies(setCookie?: string[]): void {
    if (!setCookie?.length) return;
    this.headers.cookie = this.cookie.update(setCookie).stringify();
  }

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
