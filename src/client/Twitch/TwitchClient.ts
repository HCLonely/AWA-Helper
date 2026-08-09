/**
 * @file src/client/Twitch/TwitchClient.ts
 * @description 聚合 Twitch 会话、频道和扩展接口，供观看任务编排调用。
 */
import { TwitchContext, type TwitchContextOptions } from './TwitchContext';
import { checkLinkedExtension, getChannelInfo, getChannelsInfo, getExtensionInfo, verifySession } from './APIs';

export class TwitchClient {
  readonly context: TwitchContext;
  /**
   * 初始化 Twitch Client 实例。
   * @param options - 创建实例或执行操作所需的配置选项，类型为 `TwitchContextOptions`。
   */
  constructor(options: TwitchContextOptions) {
    this.context = new TwitchContext(options);
  }
  /**
   * 获取 session。
   * @returns `{ verify: () => Promise<string>; }`，session 相关操作组成的 API 集合。
   */
  get session() {
    return {
      /**
       * 检查 verify 相关数据。
       * @returns `Promise<string>`，verify 获取或生成的文本内容。
       */
      verify: () => verifySession(this.context)
    };
  }
  /**
   * 获取 channels。
   * @returns `object`，channels 相关操作组成的 API 集合。
   */
  get channels() {
    return {
      /**
       * 获取 get 相关数据。
       * @param channelLogin - 用于定位目标对象的名称，类型为 `string`。
       * @returns 找到频道时携带频道 ID，否则携带 `not-found` 原因。
       */
      get: (channelLogin: string) => getChannelInfo(this.context, channelLogin),
      /**
       * 获取 find Tracking 相关数据。
       * @param channelLogins - 用于查询直播状态的 Twitch 频道登录名列表，类型为 `string[]`。
       * @returns 找到可跟踪频道时携带跟踪信息，否则携带 `no-trackable-channel` 原因。
       */
      findTracking: (channelLogins: string[]) => getChannelsInfo(this.context, channelLogins)
    };
  }
  /**
   * 获取 extensions。
   * @returns Twitch 扩展关联检查和扩展信息查找 API 集合。
   */
  get extensions() {
    return {
      /**
       * 检查 check Linked 相关数据。
       * @returns 包含 `linked` 或 `not-linked` 状态的结构化结果。
       */
      checkLinked: () => checkLinkedExtension(this.context),
      /**
       * 获取 get 相关数据。
       * @param channelId - 目标资源的唯一标识，类型为 `string`。
       * @returns 找到扩展时携带扩展信息，否则携带 `not-found` 原因。
       */
      get: (channelId: string) => getExtensionInfo(this.context, channelId)
    };
  }
}
