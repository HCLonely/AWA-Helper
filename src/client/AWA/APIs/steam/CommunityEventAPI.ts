/**
 * @file src/client/AWA/APIs/steam/CommunityEventAPI.ts
 * @description 封装 AWA Steam 社区活动信息和加入活动请求。
 */
import type { AxiosResponse } from 'axios';
import { AWAContext } from '../../AWAContext';
import { parseCommunityEvent, parseCommunityEventPath } from '../../parsers';
import type { CommunityEventPage } from '../../types';

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
   * @returns `Promise<string | null>`，findPath 获取到的数据。
   */
  async findPath(): Promise<string | null> {
    const response = await this.get<string>(`${this.context.baseURL}/steam/events`);
    if (String(response.data).includes('concluded')) return null;
    return parseCommunityEventPath(String(response.data));
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
   * @returns `Promise<boolean>`，表示 checkOwned 检查是否通过。
   */
  async checkOwned(path: string): Promise<boolean> {
    const response = await this.get<{ installed?: boolean }>(`${this.context.baseURL}/ajax/user/steam/community-event/check-owned-games/${path}`);
    return response.data?.installed === true;
  }
  /**
   * 处理 join 相关逻辑。
   * @param path - 待读取或写入文件的路径，类型为 `string`。
   * @returns `Promise<boolean>`，表示 join 检查是否通过。
   */
  async join(path: string): Promise<boolean> {
    const response = await this.get<{ success?: boolean }>(`${this.context.baseURL}/ajax/user/steam/community-event/start/${path}`);
    return response.data?.success === true;
  }
}
