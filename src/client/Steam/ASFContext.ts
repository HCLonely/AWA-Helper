/** Connection state for ArchiSteamFarm IPC requests. */
import type { RawAxiosRequestHeaders } from 'axios';
import { http } from '../../tools';
import { createHttpTransport, createProxyAgent, type HttpTransport } from '../shared';

export interface ASFContextOptions {
  protocol: string;
  host: string;
  port: number;
  password?: string;
  botName: string;
  proxy?: proxy;
  transport?: HttpTransport;
}

export class ASFContext {
  readonly commandURL: string;
  readonly headers: RawAxiosRequestHeaders;
  readonly botName: string;
  readonly httpsAgent?: myAxiosConfig['httpsAgent'];
  readonly transport: HttpTransport;

  constructor(options: ASFContextOptions) {
    const baseURL = `${options.protocol}://${options.host}:${options.port}`;
    this.transport = options.transport || createHttpTransport(http);
    this.commandURL = `${baseURL}/Api/Command`;
    this.botName = options.botName;
    this.headers = {
      accept: 'application/json',
      'Content-Type': 'application/json',
      Host: `${options.host}:${options.port}`,
      Origin: baseURL,
      Referer: `${baseURL}/page/commands`,
      ...(options.password && { Authentication: options.password })
    };
    if (options.proxy?.enable?.includes('asf') && options.proxy.host && options.proxy.port) {
      this.httpsAgent = createProxyAgent(options.proxy);
    }
  }

  request<T = unknown>(options: myAxiosConfig) {
    const requestOptions: myAxiosConfig = { ...options, headers: { ...this.headers, ...options.headers } };
    if (this.httpsAgent && !requestOptions.httpsAgent) requestOptions.httpsAgent = this.httpsAgent;
    return this.transport.request<T>(requestOptions);
  }
}
