/**
 * @file src/client/Steam/ASFContext.ts
 * @description 维护 ASF IPC 地址、身份请求头和可注入 HTTP 传输状态。
 */
import type { RawAxiosRequestHeaders } from 'axios';
import { http } from '../../tools';
import { observeExternalRequest } from '../../tools/logging';
import { createHttpTransport, createProxyAgent, type HttpTransport } from '../shared';

export interface ASFContextOptions {
  protocol: string;
  host: string;
  port: number;
  password?: string;
  botName: string;
  proxy?: proxy;
  transport?: HttpTransport;
  /** 是否记录真实网络请求；注入测试 transport 时默认关闭。 */
  logRequests?: boolean;
}

export class ASFContext {
  readonly commandURL: string;
  readonly headers: RawAxiosRequestHeaders;
  readonly botName: string;
  readonly httpsAgent?: myAxiosConfig['httpsAgent'];
  readonly transport: HttpTransport;
  private readonly logRequests: boolean;

  /**
   * 初始化 ASFContext 实例。
   * @param options - 创建实例或执行操作所需的配置选项，类型为 `ASFContextOptions`。
   */
  constructor(options: ASFContextOptions) {
    const baseURL = `${options.protocol}://${options.host}:${options.port}`;
    this.transport = options.transport || createHttpTransport(http);
    this.logRequests = options.logRequests ?? false;
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

  /**
   * 请求 request 相关数据。
   * @param options - 创建实例或执行操作所需的配置选项，类型为 `myAxiosConfig`。
   * @returns `Promise<AxiosResponse<T, any, {}, any>>`，request 请求返回的响应结果。
   */
  request<T = unknown>(options: myAxiosConfig) {
    const requestOptions: myAxiosConfig = { ...options, headers: { ...this.headers, ...options.headers } };
    if (this.httpsAgent && !requestOptions.httpsAgent) {
      requestOptions.httpsAgent = this.httpsAgent;
    }
    const execute = () => this.transport.request<T>(requestOptions);
    return this.logRequests ? observeExternalRequest('ASF', requestOptions, execute) : execute();
  }
}
