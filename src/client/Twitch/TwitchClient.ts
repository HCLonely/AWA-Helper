/**
 * @file src/client/Twitch/TwitchClient.ts
 * @description 聚合 Twitch 会话、频道和扩展接口，供观看任务编排调用。
 */
import { TwitchContext } from './TwitchContext';
import { checkLinkedExtension, getChannelInfo, getChannelsInfo, getExtensionInfo, verifySession } from './APIs';
import type { TwitchChannelTrackingInfo } from './types';
import chalk from 'chalk';
import { Logger, time } from '../../tools';

export class TwitchClient {
  readonly context: TwitchContext;
  /**
   * 初始化 Twitch Client 实例。
   * @param options - 创建实例或执行操作所需的配置选项，类型为 `{ cookie: string; proxy?: proxy; userAgent?: string; }`。
   */
  constructor(options: { cookie: string; proxy?: proxy; userAgent?: string }) { this.context = new TwitchContext(options); }
  /**
   * 初始化 init 相关数据。
   * @returns `Promise<boolean>`，表示 init 检查是否通过。
   */
  async init(): Promise<boolean> {
    const sessionLogger = new Logger(`${time()}${__('initing', chalk.yellow('TwitchTrack'))}`, false);
    try {
      await verifySession(this.context);
      sessionLogger.log(chalk.green('OK'));
      const authorizationLogger = new Logger(`${time()}${__('checkAuthorization', chalk.yellow('Twitch'))}`, false);
      const linked = await checkLinkedExtension(this.context);
      authorizationLogger.log(linked ? chalk.green(__('authorized')) : chalk.red(__('notAuthorized')));
      return linked;
    } catch (error) {
      sessionLogger.log(chalk.red('Error'));
      new Logger(error);
      return false;
    }
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
       * @returns `Promise<string | null>`，get 获取到的数据。
       */
      get: (channelLogin: string) => getChannelInfo(this.context, channelLogin),
      /**
       * 获取 find Tracking 相关数据。
       * @param channelLogins - 用于查询直播状态的 Twitch 频道登录名列表，类型为 `string[]`。
       * @returns `Promise<TwitchChannelTrackingInfo | null>`，findTracking 获取到的数据。
       */
      findTracking: (channelLogins: string[]) => getChannelsInfo(this.context, channelLogins)
    };
  }
  /**
   * 获取 extensions。
   * @returns `{ checkLinked: () => Promise<boolean>; get: (channelId: string) => Promise<TwitchExtensionInfo | null>; }`，extensions 相关操作组成的 API 集合。
   */
  get extensions() {
    return {
      /**
       * 检查 check Linked 相关数据。
       * @returns `Promise<boolean>`，表示 checkLinked 检查是否通过。
       */
      checkLinked: () => checkLinkedExtension(this.context),
      /**
       * 获取 get 相关数据。
       * @param channelId - 目标资源的唯一标识，类型为 `string`。
       * @returns `Promise<TwitchExtensionInfo | null>`，get 获取到的数据。
       */
      get: (channelId: string) => getExtensionInfo(this.context, channelId)
    };
  }
  /**
   * 获取 get Channel Id 相关数据。
   * @param channelLogin - 用于定位目标对象的名称，类型为 `string`。
   * @returns `Promise<string | null>`，getChannelId 获取到的数据。
   */
  getChannelId(channelLogin: string): Promise<string | null> { return getChannelInfo(this.context, channelLogin); }
  /**
   * 获取 find Tracking Channel 相关数据。
   * @param channelLogins - 用于查询直播状态的 Twitch 频道登录名列表，类型为 `string[]`。
   * @returns `Promise<TwitchChannelTrackingInfo | null>`，findTrackingChannel 获取到的数据。
   */
  findTrackingChannel(channelLogins: string[]): Promise<TwitchChannelTrackingInfo | null> { return getChannelsInfo(this.context, channelLogins); }
  /**
   * 获取 get Tracking Info 相关数据。
   * @param channelLogin - 用于定位目标对象的名称，类型为 `string`。
   * @returns `Promise<TwitchChannelTrackingInfo | null>`，getTrackingInfo 获取到的数据。
   */
  async getTrackingInfo(channelLogin: string): Promise<TwitchChannelTrackingInfo | null> {
    const channelId = await getChannelInfo(this.context, channelLogin);
    if (!channelId) return null;
    const extension = await getExtensionInfo(this.context, channelId);
    return extension ? { channelId, streamerName: channelLogin, ...extension } : null;
  }
}
