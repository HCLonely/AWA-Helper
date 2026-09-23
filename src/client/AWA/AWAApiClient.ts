/**
 * @file src/client/AWA/AWAApiClient.ts
 * @description 聚合拆分后的 AWA API，为业务层提供类型安全的统一客户端门面。
 */
import type { userAvatarInfo } from '../../types/achievement';
import { AWAContext, type AWAContextOptions } from './AWAContext';
import {
  claimQuestAward, completeGetStartedItem, getAchievements, getAvailableStreams, getAvatarItems, getControlCenter,
  getTwitchBonus, openPage, recordPostView, recordPromotionView, refreshSession, replyPost, saveAvatar,
  sendTimeOnSiteTrack, sendTwitchTrack, sharePost, verifySession
} from './APIs';
import { CommunityEventAPI, SteamQuestAPI } from './APIs/steam';
import { ArtifactAPI } from './APIs/artifacts';
import { BattlePassAPI } from './APIs/battlePass';

export class AWAApiClient {
  readonly context: AWAContext;
  readonly steam: SteamQuestAPI;
  readonly artifacts: ArtifactAPI;
  readonly communityEvent: CommunityEventAPI;
  readonly battlePass: BattlePassAPI;
  /**
   * 初始化 AWAApiClient 实例。
   * @param options - 创建实例或执行操作所需的配置选项，类型为 `AWAContextOptions`。
   */
  constructor(options: AWAContextOptions) {
    this.context = new AWAContext(options);
    this.steam = new SteamQuestAPI(this.context);
    this.artifacts = new ArtifactAPI(this.context);
    this.communityEvent = new CommunityEventAPI(this.context);
    this.battlePass = new BattlePassAPI(this.context);
  }
  /**
   * 获取 new Cookie。
   * @returns `string`，当前会话序列化后的 Cookie 字符串。
   */
  get newCookie(): string {
    return this.context.cookie.stringify();
  }
  /**
   * 获取 session。
   * @returns `{ refresh: () => Promise<string>; verify: () => Promise<{ userId: string; username: string; }>; }`，session 相关操作组成的 API 集合。
   */
  get session() {
    return {
      /**
       * 刷新状态。
       * @returns `Promise<string>`，refresh 获取或生成的文本内容。
       */
      refresh: () => refreshSession(this.context),
      /**
       * 验证状态。
       * @returns `Promise<{ userId: string; username: string; }>`，表示 verify 的检查结论。
       */
      verify: () => verifySession(this.context)
    };
  }
  /**
   * 获取 quests。
   * @returns `object`，quests 相关操作组成的 API 集合。
   */
  get quests() {
    return {
      /**
       * 获取控制中心页面。
       * @returns `Promise<string>`，getControlCenter 获取或生成的文本内容。
       */
      getControlCenter: () => getControlCenter(this.context),
      /**
       * 领取奖励。
       * @param questId - 目标资源的唯一标识，类型为 `string`。
       * @returns 包含 `claimed` 或 `rejected` 状态的结构化结果。
       */
      claimAward: (questId: string) => claimQuestAward(this.context, questId),
      /**
       * 上报在线时长。
       * @param link - 需要访问或提交的目标页面链接，类型为 `string | undefined`。
       * @returns 包含 `tracked` 或 `rejected` 状态的结构化结果。
       */
      sendTimeOnSite: (link?: string) => sendTimeOnSiteTrack(this.context, link),
      /**
       * 完成入门清单项目。
       * @param link - 需要访问或提交的目标页面链接，类型为 `string`。
       * @returns 包含 `completed` 或 `rejected` 状态的结构化结果。
       */
      completeGetStartedItem: (link: string) => completeGetStartedItem(this.context, link)
    };
  }
  /**
   * 获取 content。
   * @returns `object`，content 相关操作组成的 API 集合。
   */
  get content() {
    return {
      /**
       * 打开目标页面。
       * @param link - 需要访问或提交的目标页面链接，类型为 `string`。
       * @returns `Promise<string>`，openPage 获取或生成的文本内容。
       */
      openPage: (link: string) => openPage(this.context, link),
      /**
       * 记录帖子浏览。
       * @param postId - 目标资源的唯一标识，类型为 `string`。
       * @returns 包含 `recorded` 或 `rejected` 状态的结构化结果。
       */
      recordPostView: (postId: string) => recordPostView(this.context, postId),
      /**
       * 回复帖子。
       * @param postId - 目标资源的唯一标识，类型为 `string | undefined`。
       * @returns 包含 `replied`、`no-topic` 或 `rejected` 状态的结构化结果。
       */
      replyPost: (postId?: string) => replyPost(this.context, postId),
      /**
       * 分享帖子。
       * @param postId - 目标资源的唯一标识，类型为 `string`。
       * @returns 包含 `shared` 或 `rejected` 状态的结构化结果。
       */
      sharePost: (postId: string) => sharePost(this.context, postId),
      /**
       * 记录推广内容浏览。
       * @param id - 目标资源的唯一标识，类型为 `string`。
       * @param token - 远程服务用于身份验证的凭据，类型为 `string`。
       * @returns 包含 `recorded` 或 `rejected` 状态的结构化结果。
       */
      recordPromotionView: (id: string, token: string) => recordPromotionView(this.context, id, token)
    };
  }
  /**
   * 获取 personalization。
   * @returns `object`，personalization 相关操作组成的 API 集合。
   */
  get personalization() {
    return {
      /**
       * 获取头像或边框列表。
       * @param type - 用于选择处理分支的类型，类型为 `"avatar" | "border"`。
       * @returns 找到配置时携带配置值，否则携带 `not-found` 原因。
       */
      getAvatarItems: (type: 'avatar' | 'border') => getAvatarItems(this.context, type),
      /**
       * 保存头像配置。
       * @param avatar - 需要保存的用户头像配置，类型为 `userAvatarInfo`。
       * @returns 包含 `saved` 或 `rejected` 状态的结构化结果。
       */
      saveAvatar: (avatar: userAvatarInfo) => saveAvatar(this.context, avatar)
    };
  }
  /**
   * 获取 twitch。
   * @returns `object`，twitch 相关操作组成的 API 集合。
   */
  get twitch() {
    return {
      /**
       * 获取可用直播列表。
       * @returns `Promise<AvailableStreams>`，getAvailableStreams 获取到的数据。
       */
      getAvailableStreams: () => getAvailableStreams(this.context),
      /**
       * 获取奖励加成。
       * @param profilePath - 待读取或写入文件的路径，类型为 `string`。
       * @returns `Promise<number>`，getBonus 计算或读取到的数值。
       */
      getBonus: (profilePath: string) => getTwitchBonus(this.context, profilePath),
      /**
       * 上报跟踪记录。
       * @param payload - 当前请求或操作使用的数据内容，类型为 `{ channelId: string; jwt: string; extensionID?: string; }`。
       * @returns `Promise<TwitchTrackResult>`，sendTrack 请求返回的响应结果。
       */
      sendTrack: (payload: {
        channelId: string;
        jwt: string;
        extensionID?: string
      }) => sendTwitchTrack(this.context, payload)
    };
  }
  /**
   * 获取 achievement。
   * @returns `{ getAll: () => Promise<Achievement[]>; }`，achievement 相关操作组成的 API 集合。
   */
  get achievement() {
    return {
      /**
       * 获取全部数据。
       * @returns `Promise<Achievement[]>`，getAll 收集或筛选得到的数据列表。
       */
      getAll: () => getAchievements(this.context)
    };
  }
}
