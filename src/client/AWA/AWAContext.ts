/** Mutable AWA session state shared by the small AWA API modules. */
import type { RawAxiosRequestHeaders } from 'axios';
import { Cookie, formatProxy } from '../../tools';

export interface AWAContextOptions {
  cookie: string;
  host?: string;
  userAgent?: string;
  proxy?: proxy;
}

export class AWAContext {
  host: string;
  readonly cookie: Cookie;
  readonly headers: RawAxiosRequestHeaders;
  readonly httpsAgent?: myAxiosConfig['httpsAgent'];
  userId?: string;
  username?: string;

  constructor(options: AWAContextOptions) {
    this.host = options.host || globalThis.awaHost || 'www.alienwarearena.com';
    this.cookie = new Cookie(options.cookie);
    this.headers = {
      cookie: this.cookie.stringify(),
      'user-agent': options.userAgent || globalThis.userAgent,
      'accept-encoding': 'gzip, deflate, br',
      'accept-language': 'zh-CN,zh;q=0.9,en;q=0.8,en-GB;q=0.7,en-US;q=0.6'
    };
    if (options.proxy?.enable?.includes('awa') && options.proxy.host && options.proxy.port) {
      this.httpsAgent = formatProxy(options.proxy);
    }
  }

  get baseURL(): string {
    return `https://${this.host}`;
  }

  updateCookies(setCookie?: string[]): void {
    if (!setCookie?.length) return;
    this.headers.cookie = this.cookie.update(setCookie).stringify();
  }
}
