/**
 * @file src/client/AWA/APIs/steam/SteamQuestAPI.ts
 * @description 封装 AWA Steam 任务列表、详情、启动和进度接口。
 */
import type { AxiosResponse } from 'axios';
import { AWAContext } from '../../AWAContext';
import { parseSelectableSteamGameId, parseSteamQuestDetail, parseSteamQuestListings, parseSteamQuestProgress } from '../../parsers';
import type { AWASteamQuestDetail, AWASteamQuestListing } from '../../types';

export class SteamQuestAPI {
  /**
   * 初始化 Steam Quest API 实例。
   * @param context - 发起远程请求及保存会话状态所需的客户端上下文，类型为 `AWAContext`。
   */
  constructor(private readonly context: AWAContext) {}

  /**
   * 请求 request 相关数据。
   * @param options - 创建实例或执行操作所需的配置选项，类型为 `myAxiosConfig`。
   * @returns `Promise<AxiosResponse<T, any, {}, any>>`，request 请求返回的响应结果。
   */
  private async request<T = unknown>(options: myAxiosConfig): Promise<AxiosResponse<T>> {
    options.headers = { ...this.context.headers, ...options.headers, cookie: this.context.cookie.stringify() };
    if (this.context.httpsAgent) options.httpsAgent = this.context.httpsAgent;
    const response = await this.context.request<T>(options);
    this.context.updateCookies(response.headers?.['set-cookie']);
    return response;
  }

  /**
   * 获取 get Steam Quests 相关数据。
   * @returns `Promise<AWASteamQuestListing[]>`，getSteamQuests 收集或筛选得到的数据列表。
   */
  async getSteamQuests(): Promise<AWASteamQuestListing[]> {
    const response = await this.request<string>({ url: `${this.context.baseURL}/steam/quests`, method: 'GET' });
    return parseSteamQuestListings(String(response.data), this.context.baseURL);
  }

  /**
   * 获取 get Quest Detail 相关数据。
   * @param url - 目标资源或服务的 URL，类型为 `string`。
   * @returns `Promise<AWASteamQuestDetail>`，getQuestDetail 获取到的数据。
   */
  async getQuestDetail(url: string): Promise<AWASteamQuestDetail> {
    const response = await this.request<string>({ url, method: 'GET', responseType: 'text', headers: { referer: `${this.context.baseURL}/steam/quests` } });
    return parseSteamQuestDetail(String(response.data));
  }

  /**
   * 获取 get Selectable Game Id 相关数据。
   * @param url - 目标资源或服务的 URL，类型为 `string`。
   * @returns `Promise<string | null>`，getSelectableGameId 获取到的数据。
   */
  async getSelectableGameId(url: string): Promise<string | null> {
    const response = await this.request<string>({ url, method: 'GET', responseType: 'text', headers: { referer: `${this.context.baseURL}/steam/quests` } });
    return parseSelectableSteamGameId(String(response.data));
  }

  /**
   * 检查 check Owned Games 相关数据。
   * @param name - 用于定位目标对象的名称，类型为 `string`。
   * @returns `Promise<boolean>`，表示 checkOwnedGames 检查是否通过。
   */
  async checkOwnedGames(name: string): Promise<boolean> {
    if (name === 'choose-your-own-game') return true;
    const response = await this.request<{ installed?: boolean }>({
      url: `${this.context.baseURL}/ajax/user/steam/quests/check-owned-games/${name}`,
      method: 'GET', headers: { referer: `${this.context.baseURL}/steam/quests/${name}` }
    });
    return response.data?.installed === true;
  }

  /**
   * 处理 sync Games 相关逻辑。
   * @param url - 目标资源或服务的 URL，类型为 `string`。
   * @returns `Promise<boolean>`，表示 syncGames 检查是否通过。
   */
  async syncGames(url: string): Promise<boolean> {
    const response = await this.request<{ success?: boolean }>({
      url: url.replace('steam/quests', 'ajax/user/steam/quests/sync-owned-games'), method: 'GET',
      responseType: 'json', headers: { referer: url }
    });
    return response.data?.success === true;
  }

  /**
   * 获取 select Game 相关数据。
   * @param url - 目标资源或服务的 URL，类型为 `string`。
   * @param gameId - 需要处理的 Steam 应用标识列表，类型为 `string`。
   * @returns `Promise<boolean>`，表示 selectGame 检查是否通过。
   */
  async selectGame(url: string, gameId: string): Promise<boolean> {
    const response = await this.request<unknown>({
      url: url.replace('steam/quests', 'ajax/user/steam/quests/start-select-own'), method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8', referer: url }, data: gameId
    });
    return response.status === 200;
  }

  /**
   * 执行 start Quest 相关数据。
   * @param url - 目标资源或服务的 URL，类型为 `string`。
   * @returns `Promise<boolean>`，表示 startQuest 检查是否通过。
   */
  async startQuest(url: string): Promise<boolean> {
    const response = await this.request<{ success?: boolean }>({
      url: url.replace('steam/quests', 'ajax/user/steam/quests/start'), method: 'GET', headers: { referer: url }
    });
    return response.data?.success === true;
  }

  /**
   * 获取 get Quest Progress 相关数据。
   * @param url - 目标资源或服务的 URL，类型为 `string`。
   * @returns `Promise<number | null>`，getQuestProgress 获取到的数据。
   */
  async getQuestProgress(url: string): Promise<number | null> {
    const response = await this.request<string>({ url, method: 'GET', responseType: 'text', headers: { referer: `${this.context.baseURL}/steam/quests` } });
    return parseSteamQuestProgress(String(response.data));
  }
}
