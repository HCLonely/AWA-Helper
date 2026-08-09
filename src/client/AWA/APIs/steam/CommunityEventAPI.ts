/**
 * @file src/client/AWA/APIs/steam/CommunityEventAPI.ts
 * @description 封装 AWA Steam 社区活动信息和加入活动请求。
 */
import type { AxiosResponse } from 'axios';
import { AWAContext } from '../../AWAContext';
import { parseCommunityEvent, parseCommunityEventPath } from '../../parsers';
import type { CommunityEventPage } from '../../types';
import type { ActionResult, LookupResult } from '../../../shared';

export class CommunityEventAPI {
  /**
   * 初始化 Community Event API 实例。
   * @param context - 发起远程请求及保存会话状态所需的客户端上下文，类型为 `AWAContext`。
   */
  constructor(private readonly context: AWAContext) {}
  /**
   * 获取 get 相关数据。
   * @param url - 目标资源或服务的 URL，类型为 `string`。
   * @returns `Promise<AxiosResponse<T, any, {}, any>>`，get 获取到的数据。
   */
  private async get<T = unknown>(url: string): Promise<AxiosResponse<T>> {
    const options: myAxiosConfig = { url, method: 'GET', headers: { ...this.context.headers, referer: this.context.baseURL } };
    if (this.context.httpsAgent) options.httpsAgent = this.context.httpsAgent;
    return this.context.request<T>(options);
  }
  /**
   * 获取 find Path 相关数据。
   * @returns 找到活动时返回路径；活动已结束或页面无活动时返回对应原因。
   */
  async findPath(): Promise<LookupResult<string, 'concluded' | 'not-found'>> {
    const response = await this.get<string>(`${this.context.baseURL}/steam/events`);
    if (String(response.data).includes('concluded')) return { found: false, reason: 'concluded' };
    const path = parseCommunityEventPath(String(response.data));
    return path ? { found: true, value: path } : { found: false, reason: 'not-found' };
  }
  /**
   * 获取 get Event 相关数据。
   * @param path - 待读取或写入文件的路径，类型为 `string`。
   * @returns `Promise<CommunityEventPage>`，getEvent 获取到的数据。
   */
  async getEvent(path: string): Promise<CommunityEventPage> {
    const response = await this.get<string>(`${this.context.baseURL}/steam/community-event/${path}`);
    return parseCommunityEvent(String(response.data), path);
  }
  /**
   * 检查 check Owned 相关数据。
   * @param path - 待读取或写入文件的路径，类型为 `string`。
   * @returns 已拥有活动游戏时返回 `owned`，否则返回 `not-owned`。
   */
  async checkOwned(path: string): Promise<ActionResult<'owned', 'not-owned'>> {
    const response = await this.get<{ installed?: boolean }>(`${this.context.baseURL}/ajax/user/steam/community-event/check-owned-games/${path}`);
    return response.data?.installed === true ? { ok: true, state: 'owned' } : { ok: false, state: 'not-owned' };
  }
  /**
   * 处理 join 相关逻辑。
   * @param path - 待读取或写入文件的路径，类型为 `string`。
   * @returns 加入成功时返回 `joined`，远程拒绝时返回 `rejected`。
   */
  async join(path: string): Promise<ActionResult<'joined', 'rejected'>> {
    const response = await this.get<{ success?: boolean }>(`${this.context.baseURL}/ajax/user/steam/community-event/start/${path}`);
    return response.data?.success === true ? { ok: true, state: 'joined' } : { ok: false, state: 'rejected' };
  }
}
