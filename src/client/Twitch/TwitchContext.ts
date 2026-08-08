/** Authentication and transport state for Twitch-only requests. */
import type { RawAxiosRequestHeaders } from 'axios';
import { Cookie, formatProxy } from '../../tools';

export class TwitchContext {
  readonly cookie: Cookie;
  readonly headers: RawAxiosRequestHeaders;
  readonly httpsAgent?: myAxiosConfig['httpsAgent'];
  clientId?: string;

  constructor({ cookie, proxy, userAgent }: { cookie: string; proxy?: proxy; userAgent?: string }) {
    this.cookie = new Cookie(cookie);
    this.headers = {
      Authorization: `OAuth ${this.cookie.get('auth-token')}`,
      'Content-Type': 'text/plain;charset=UTF-8',
      Host: 'gql.twitch.tv',
      Origin: 'https://www.twitch.tv',
      Referer: 'https://www.twitch.tv/',
      'User-Agent': userAgent || globalThis.userAgent,
      'X-Device-Id': this.cookie.get('unique_id') as string
    };
    if (proxy?.enable?.includes('twitch') && proxy.host && proxy.port) {
      this.httpsAgent = formatProxy(proxy);
    }
  }
}
