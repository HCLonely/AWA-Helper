/**
 * @file src/client/shared/HttpError.ts
 * @description 定义与具体平台无关的 HTTP 传输错误及重试属性。
 */
export class HttpError extends Error {
  /**
   * 初始化 HttpError 实例。
   * @param message - 需要记录、推送或格式化的文本内容，类型为 `string`。
   * @param statusCode - 远程响应携带的 HTTP 状态码，类型为 `number | undefined`。
   * @param retryable - 用于标记失败后是否允许重试，类型为 `boolean`。
   * @param options - 创建实例或执行操作所需的配置选项，类型为 `ErrorOptions | undefined`。
   */
  constructor(message: string, readonly statusCode?: number, readonly retryable = false, options?: ErrorOptions) {
    super(message, options);
    this.name = 'HttpError';
  }
}
