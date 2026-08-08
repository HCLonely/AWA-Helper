/** Connection state for ArchiSteamFarm IPC requests. */
import type { RawAxiosRequestHeaders } from 'axios';
import { formatProxy } from '../../tools';

export interface ASFContextOptions {
  protocol: string;
  host: string;
  port: number;
  password?: string;
  botName: string;
  proxy?: proxy;
}

export class ASFContext {
  readonly commandURL: string;
  readonly headers: RawAxiosRequestHeaders;
  readonly botName: string;
  readonly httpsAgent?: myAxiosConfig['httpsAgent'];

  constructor(options: ASFContextOptions) {
    const baseURL = `${options.protocol}://${options.host}:${options.port}`;
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
      this.httpsAgent = formatProxy(options.proxy);
    }
  }
}
