/** Authentication and transport state for Twitch-only requests. */
import type { RawAxiosRequestHeaders } from 'axios';
import { Cookie, http } from '../../tools';
import { createHttpTransport, createProxyAgent, DEFAULT_USER_AGENT, type CookieStore, type HttpTransport } from '../shared';

export class TwitchContext {
  readonly cookie: CookieStore;
  readonly headers: RawAxiosRequestHeaders;
  readonly httpsAgent?: myAxiosConfig['httpsAgent'];
  clientId?: string;

  readonly transport: HttpTransport;

  constructor({ cookie, proxy, userAgent, transport }: { cookie: string; proxy?: proxy; userAgent?: string; transport?: HttpTransport }) {
    this.cookie = new Cookie(cookie);
    this.transport = transport || createHttpTransport(http);
    this.headers = {
      Authorization: `OAuth ${this.cookie.get('auth-token')}`,
      'Content-Type': 'text/plain;charset=UTF-8',
      Host: 'gql.twitch.tv',
      Origin: 'https://www.twitch.tv',
      Referer: 'https://www.twitch.tv/',
      'User-Agent': userAgent || DEFAULT_USER_AGENT,
      'X-Device-Id': this.cookie.get('unique_id') as string
    };
    if (proxy?.enable?.includes('twitch') && proxy.host && proxy.port) {
      this.httpsAgent = createProxyAgent(proxy);
    }
  }

  request<T = unknown>(options: myAxiosConfig) {
    const requestOptions: myAxiosConfig = { ...options, headers: { ...this.headers, ...options.headers } };
    if (this.httpsAgent && !requestOptions.httpsAgent) requestOptions.httpsAgent = this.httpsAgent;
    return this.transport.request<T>(requestOptions);
  }
}
