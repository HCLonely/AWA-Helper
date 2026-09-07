/**
 * @file src/client/AWA/APIs/steam/SteamQuestAPI.ts
 * @description 封装 AWA Steam 任务列表、详情、启动和进度接口。
 */
import type { AxiosResponse } from 'axios';
import { AWAContext } from '../../AWAContext';
import { parseSelectableSteamGameId, parseSteamQuestDetail, parseSteamQuestListings, parseSteamQuestProgress } from '../../parsers';
import type { AWASteamQuestDetail, AWASteamQuestListing } from '../../types';
import type { ActionResult, LookupResult } from '../../../shared';

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
    if (this.context.httpsAgent) {
      options.httpsAgent = this.context.httpsAgent;
    }
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
   * @returns 找到可选游戏时返回游戏 ID，否则返回 `not-found`。
   */
  async getSelectableGameId(url: string): Promise<LookupResult<string>> {
    const response = await this.request<string>({ url, method: 'GET', responseType: 'text', headers: { referer: `${this.context.baseURL}/steam/quests` } });
    const gameId = parseSelectableSteamGameId(String(response.data));
    return gameId ? { found: true, value: gameId } : { found: false, reason: 'not-found' };
  }

  /**
   * 检查 check Owned Games 相关数据。
   * @param name - 用于定位目标对象的名称，类型为 `string`。
   * @returns 返回 `owned`、`not-required` 或 `not-owned` 所有权状态。
   */
  async checkOwnedGames(name: string): Promise<ActionResult<'owned' | 'not-required', 'not-owned'>> {
    if (name === 'choose-your-own-game') {
      return { ok: true, state: 'not-required' };
    }
    const response = await this.request<{ installed?: boolean }>({
      url: `${this.context.baseURL}/ajax/user/steam/quests/check-owned-games/${name}`,
      method: 'GET', headers: { referer: `${this.context.baseURL}/steam/quests/${name}` }
    });
    return response.data?.installed === true ? { ok: true, state: 'owned' } : { ok: false, state: 'not-owned' };
  }

  /**
   * 处理 sync Games 相关逻辑。
   * @param url - 目标资源或服务的 URL，类型为 `string`。
   * @returns 同步成功时返回 `synced`，远程拒绝时返回 `rejected`。
   */
  async syncGames(url: string): Promise<ActionResult<'synced', 'rejected'>> {
    const response = await this.request<{ success?: boolean }>({
      url: url.replace('steam/quests', 'ajax/user/steam/quests/sync-owned-games'), method: 'GET', retryTimes: 0,
      responseType: 'json', headers: { referer: url }
    });
    return response.data?.success === true ? { ok: true, state: 'synced' } : { ok: false, state: 'rejected' };
  }

  /**
   * 获取 select Game 相关数据。
   * @param url - 目标资源或服务的 URL，类型为 `string`。
   * @param gameId - 需要处理的 Steam 应用标识列表，类型为 `string`。
   * @returns 选中成功时返回 `selected`，远程拒绝时返回 `rejected`。
   */
  async selectGame(url: string, gameId: string): Promise<ActionResult<'selected', 'rejected'>> {
    const response = await this.request<unknown>({
      url: url.replace('steam/quests', 'ajax/user/steam/quests/start-select-own'), method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8', referer: url }, data: gameId
    });
    return response.status === 200 ? { ok: true, state: 'selected' } : { ok: false, state: 'rejected' };
  }

  /**
   * 执行 start Quest 相关数据。
   * @param url - 目标资源或服务的 URL，类型为 `string`。
   * @returns 启动成功时返回 `started`，远程拒绝时返回 `rejected`。
   */
  async startQuest(url: string): Promise<ActionResult<'started', 'rejected'>> {
    const response = await this.request<{ success?: boolean }>({
      url: url.replace('steam/quests', 'ajax/user/steam/quests/start'), method: 'GET', retryTimes: 0, headers: { referer: url }
    });
    return response.data?.success === true ? { ok: true, state: 'started' } : { ok: false, state: 'rejected' };
  }

  /**
   * 获取 get Quest Progress 相关数据。
   * @param url - 目标资源或服务的 URL，类型为 `string`。
   * @returns 进度可解析时返回百分比，否则返回 `unavailable`。
   */
  async getQuestProgress(url: string): Promise<LookupResult<number, 'unavailable'>> {
    const response = await this.request<string>({ url, method: 'GET', responseType: 'text', headers: { referer: `${this.context.baseURL}/steam/quests` } });
    const progress = parseSteamQuestProgress(String(response.data));
    return progress === null ? { found: false, reason: 'unavailable' } : { found: true, value: progress };
  }
}
