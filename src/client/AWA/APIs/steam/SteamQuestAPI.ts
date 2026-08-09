/**
 * All Alienware Arena endpoints used by Steam quests.
 * ASF operations intentionally live under client/Steam/APIs.
 */
import type { AxiosResponse } from 'axios';
import { AWAContext } from '../../AWAContext';
import { parseSelectableSteamGameId, parseSteamQuestDetail, parseSteamQuestListings, parseSteamQuestProgress } from '../../parsers';
import type { AWASteamQuestDetail, AWASteamQuestListing } from '../../types';

export class SteamQuestAPI {
  constructor(private readonly context: AWAContext) {}

  private async request<T = unknown>(options: myAxiosConfig): Promise<AxiosResponse<T>> {
    options.headers = { ...this.context.headers, ...options.headers, cookie: this.context.cookie.stringify() };
    if (this.context.httpsAgent) options.httpsAgent = this.context.httpsAgent;
    const response = await this.context.request<T>(options);
    this.context.updateCookies(response.headers?.['set-cookie']);
    return response;
  }

  async getSteamQuests(): Promise<AWASteamQuestListing[]> {
    const response = await this.request<string>({ url: `${this.context.baseURL}/steam/quests`, method: 'GET' });
    return parseSteamQuestListings(String(response.data), this.context.baseURL);
  }

  async getQuestDetail(url: string): Promise<AWASteamQuestDetail> {
    const response = await this.request<string>({ url, method: 'GET', responseType: 'text', headers: { referer: `${this.context.baseURL}/steam/quests` } });
    return parseSteamQuestDetail(String(response.data));
  }

  async getSelectableGameId(url: string): Promise<string | null> {
    const response = await this.request<string>({ url, method: 'GET', responseType: 'text', headers: { referer: `${this.context.baseURL}/steam/quests` } });
    return parseSelectableSteamGameId(String(response.data));
  }

  async checkOwnedGames(name: string): Promise<boolean> {
    if (name === 'choose-your-own-game') return true;
    const response = await this.request<{ installed?: boolean }>({
      url: `${this.context.baseURL}/ajax/user/steam/quests/check-owned-games/${name}`,
      method: 'GET', headers: { referer: `${this.context.baseURL}/steam/quests/${name}` }
    });
    return response.data?.installed === true;
  }

  async syncGames(url: string): Promise<boolean> {
    const response = await this.request<{ success?: boolean }>({
      url: url.replace('steam/quests', 'ajax/user/steam/quests/sync-owned-games'), method: 'GET',
      responseType: 'json', headers: { referer: url }
    });
    return response.data?.success === true;
  }

  async selectGame(url: string, gameId: string): Promise<boolean> {
    const response = await this.request<unknown>({
      url: url.replace('steam/quests', 'ajax/user/steam/quests/start-select-own'), method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8', referer: url }, data: gameId
    });
    return response.status === 200;
  }

  async startQuest(url: string): Promise<boolean> {
    const response = await this.request<{ success?: boolean }>({
      url: url.replace('steam/quests', 'ajax/user/steam/quests/start'), method: 'GET', headers: { referer: url }
    });
    return response.data?.success === true;
  }

  async getQuestProgress(url: string): Promise<number | null> {
    const response = await this.request<string>({ url, method: 'GET', responseType: 'text', headers: { referer: `${this.context.baseURL}/steam/quests` } });
    return parseSteamQuestProgress(String(response.data));
  }
}
