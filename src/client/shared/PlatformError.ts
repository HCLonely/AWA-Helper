/**
 * @file src/client/shared/PlatformError.ts
 * @description 定义 AWA、Twitch 和 ASF 远程操作共享的平台错误基类。
 */
export class PlatformError extends Error {
  /**
   * 初始化 PlatformError 实例。
   * @param platform - 发生远程调用的目标平台，类型为 `"awa" | "twitch" | "asf"`。
   * @param operation - 发生错误或需要执行的远程操作名称，类型为 `string`。
   * @param message - 需要记录、推送或格式化的文本内容，类型为 `string`。
   * @param retryable - 用于标记失败后是否允许重试，类型为 `boolean`。
   * @param statusCode - 远程响应携带的 HTTP 状态码，类型为 `number | undefined`。
   * @param options - 创建实例或执行操作所需的配置选项，类型为 `ErrorOptions | undefined`。
   */
  constructor(
    readonly platform: 'awa' | 'twitch' | 'asf',
    readonly operation: string,
    message: string,
    readonly retryable = false,
    readonly statusCode?: number,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = 'PlatformError';
  }
}
