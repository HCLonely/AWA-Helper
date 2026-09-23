/**
 * @file src/client/shared/HttpTransport.ts
 * @description 定义可注入的 HTTP 传输接口，并提供基于 Axios 的默认实现。
 */
import type { AxiosResponse } from 'axios';

export interface HttpTransport {
    /**
     * 发送请求。
     * @param config - 控制当前操作行为的配置，类型为 `myAxiosConfig`。
     * @returns `Promise<AxiosResponse<T, any, {}, any>>`，request 请求返回的响应结果。
     */
request<T = unknown>(config: myAxiosConfig): Promise<AxiosResponse<T>>;
}

/**
 * 创建 HTTP 传输实现。
 * @param request - 需要格式化、上报或执行的任务信息，类型为 `(config: myAxiosConfig) => Promise<AxiosResponse>`。
 * @returns `HttpTransport`，createHttpTransport 创建的对象或数据。
 */
export const createHttpTransport = (
  request: (config: myAxiosConfig) => Promise<AxiosResponse>
): HttpTransport => ({
  /**
   * 发送请求。
   * @param config - 控制当前操作行为的配置，类型为 `myAxiosConfig`。
   * @returns `Promise<AxiosResponse<T, any, {}, any>>`，request 请求返回的响应结果。
   */
  request: <T = unknown>(config: myAxiosConfig) => request(config) as Promise<AxiosResponse<T>>
});
