/**
 * @file src/client/AWA/APIs/steam/CommunityEventAPI.ts
 * @description 封装 AWA Steam 社区活动信息和加入活动请求。
 */
import type { AxiosResponse } from 'axios';
import { AWAContext } from '../../AWAContext';
import { communityEventMatchesGame, parseCommunityEvent, parseLiveCommunityEvents } from '../../parsers';
import { getControlCenter } from '../quests/getControlCenter';
import type { CommunityEventListing, CommunityEventPage } from '../../types';
import type { ActionResult, LookupResult } from '../../../shared';

export class CommunityEventAPI {
  /**
   * 初始化 CommunityEventAPI 实例。
   * @param context - 发起远程请求及保存会话状态所需的客户端上下文，类型为 `AWAContext`。
   */
  constructor(private readonly context: AWAContext) {}
  /**
   * 获取数据。
   * @param url - 目标资源或服务的 URL，类型为 `string`。
   * @returns `Promise<AxiosResponse<T, any, {}, any>>`，get 获取到的数据。
   */
  private async get<T = unknown>(url: string, retryTimes?: number): Promise<AxiosResponse<T>> {
    const options: myAxiosConfig = {
      url,
      method: 'GET',
      retryTimes,
      headers: {
        ...this.context.headers,
        referer: this.context.baseURL
      }
    };
    if (this.context.httpsAgent) {
      options.httpsAgent = this.context.httpsAgent;
    }
    return this.context.request<T>(options);
  }
  /**
   * 查找目标路径。
   * @param gameId - 指定时匹配活动详情中的 Steam 游戏链接，避免混用其他活动的进度。
   * @returns 找到活动时返回路径；活动已结束或页面无活动时返回对应原因。
   */
  async findPath(gameId?: string): Promise<LookupResult<string, 'concluded' | 'not-found'>> {
    const paths = (await this.listEvents()).map((event) => event.path);
    let path = gameId ? undefined : paths[0];
    if (gameId) {
      for (const candidate of paths) {
        const page = await this.get<string>(`${this.context.baseURL}/steam/community-event/${candidate}`);
        if (communityEventMatchesGame(String(page.data), gameId)) {
          path = candidate;
          break;
        }
      }
    }
    return path ? {
      found: true,
      value: path
    } : {
      found: false,
      reason: 'not-found'
    };
  }
  /** 可复用每日任务刚读取的控制中心 HTML，避免再次请求。 */
  async listEvents(html?: string): Promise<CommunityEventListing[]> {
    return parseLiveCommunityEvents(html ?? await getControlCenter(this.context));
  }
  /**
   * 获取社区活动。
   * @param path - 待读取或写入文件的路径，类型为 `string`。
   * @returns `Promise<CommunityEventPage>`，getEvent 获取到的数据。
   */
  async getEvent(path: string): Promise<CommunityEventPage> {
    const response = await this.get<string>(`${this.context.baseURL}/steam/community-event/${path}`);
    return parseCommunityEvent(String(response.data), path);
  }
  /**
   * 检查游戏拥有状态。
   * @param path - 待读取或写入文件的路径，类型为 `string`。
   * @returns 已拥有活动游戏时返回 `owned`，否则返回 `not-owned`。
   */
  async checkOwned(path: string): Promise<ActionResult<'owned', 'not-owned'>> {
    const response = await this.get<{
      installed?: boolean,
      success?: boolean
    }>(`${this.context.baseURL}/ajax/user/steam/community-event/sync-owned-games/${path}`);
    return (response.data?.installed || response.data?.success) ? {
      ok: true,
      state: 'owned'
    } : {
      ok: false,
      state: 'not-owned'
    };
  }
  /**
   * 加入社区活动。
   * @param path - 待读取或写入文件的路径，类型为 `string`。
   * @returns 加入成功时返回 `joined`，远程拒绝时返回 `rejected`。
   */
  async join(path: string): Promise<ActionResult<'joined', 'rejected'>> {
    const response = await this.get<{
      success?: boolean
    }>(`${this.context.baseURL}/ajax/user/steam/community-event/start/${path}`, 0);
    return response.data?.success === true ? {
      ok: true,
      state: 'joined'
    } : {
      ok: false,
      state: 'rejected'
    };
  }
}
