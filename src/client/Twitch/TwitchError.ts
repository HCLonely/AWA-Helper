/**
 * @file src/client/Twitch/TwitchError.ts
 * @description 定义携带 Twitch 操作名称、重试标记和状态码的 GraphQL 错误。
 */
import { PlatformError } from '../shared';

export class TwitchError extends PlatformError {
  /**
   * 初始化 Twitch Error 实例。
   * @param operation - 发生错误或需要执行的远程操作名称，类型为 `string`。
   * @param message - 需要记录、推送或格式化的文本内容，类型为 `string`。
   * @param retryable - 用于标记失败后是否允许重试，类型为 `boolean`。
   * @param statusCode - 远程响应携带的 HTTP 状态码，类型为 `number | undefined`。
   * @param options - 创建实例或执行操作所需的配置选项，类型为 `ErrorOptions | undefined`。
   */
  constructor(operation: string, message: string, retryable = false, statusCode?: number, options?: ErrorOptions) {
    super('twitch', operation, message, retryable, statusCode, options);
    this.name = 'TwitchError';
  }
}
