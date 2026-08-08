/**
 * All Alienware Arena endpoints used by Steam quests.
 * ASF operations intentionally live under client/Steam/APIs.
 */
import { load } from 'cheerio';
import { AWAContext } from '../../AWAContext';
import { http } from '../tools-path';

export interface SteamQuestDetail {
  appId: string;
  runnable: boolean;
  state: 'completed' | 'ownership-required' | 'ready' | 'selection-required' | 'not-started' | 'unknown';
}

export class SteamQuestAPI {
  constructor(private readonly context: AWAContext) {}

  private async request(options: myAxiosConfig): Promise<any> {
    options.headers = { ...this.context.headers, ...options.headers, cookie: this.context.cookie.stringify() };
    if (this.context.httpsAgent) options.httpsAgent = this.context.httpsAgent;
    const response = await http(options);
    this.context.updateCookies(response.headers?.['set-cookie']);
    return response;
  }

  async getSteamQuests(): Promise<steamGameInfo[]> {
    const response = await this.request({ url: `${this.context.baseURL}/steam/quests`, method: 'GET' });
    const $ = load(response.data);
    const games: steamGameInfo[] = [];
    for (const row of $('div.container>div.row').toArray()) {
      const questPath = $(row).find('a.btn-steam-quest[href]').attr('href');
      if (!questPath) continue;
      const link = new URL(questPath, `${this.context.baseURL}/`).href;
      const detail = await this.prepareQuest(link);
      if (!detail.runnable || !detail.appId) continue;
      const time = parseInt($(row).find('.media-body p').text()
        .match(/([\d]+)\s*hour/i)?.[1] || '0', 10);
      const arp = parseInt($(row).find('.text-steam-light').text()
        .match(/([\d]+)\s*ARP/i)?.[1] || '0', 10);
      games.push({ id: detail.appId, time, arp, link });
    }
    return games;
  }

  async getQuestDetail(url: string): Promise<SteamQuestDetail> {
    const response = await this.request({ url, method: 'GET', responseType: 'text', headers: { referer: `${this.context.baseURL}/steam/quests` } });
    const html = String(response.data);
    const $ = load(html);
    const appId = $('img[src*="steam/apps/"]').first().attr('src')
      ?.match(/steam\/apps\/([\d]+)/)?.[1] ||
      html.match(/steam\/apps\/([\d]+)/)?.[1] || '';
    if (html.includes('You have completed this quest')) return { appId, runnable: false, state: 'completed' };
    if (html.includes('This quest requires that you own')) return { appId, runnable: false, state: 'ownership-required' };
    if (html.includes('Launch Game')) return { appId, runnable: true, state: 'ready' };
    if (html.includes('Sync Games')) return { appId, runnable: false, state: 'selection-required' };
    if (html.includes('Start Quest')) return { appId, runnable: false, state: 'not-started' };
    return { appId, runnable: false, state: 'unknown' };
  }

  async prepareQuest(url: string, retry = false): Promise<SteamQuestDetail> {
    const detail = await this.getQuestDetail(url);
    const name = url.match(/steam\/quests\/(.+)/)?.[1];
    if (detail.state === 'ownership-required' && name && !retry && await this.checkOwnedGames(name)) {
      return this.prepareQuest(url, true);
    }
    if (detail.state === 'selection-required' && !retry) {
      const page = await this.request({ url, method: 'GET', responseType: 'text' });
      let gameId = load(page.data)('#userGames>option').first().attr('value');
      if (!gameId && await this.syncGames(url)) {
        const refreshed = await this.request({ url, method: 'GET', responseType: 'text' });
        gameId = load(refreshed.data)('#userGames>option').first().attr('value');
      }
      if (gameId && await this.selectGame(url, gameId)) return this.prepareQuest(url, true);
    }
    if (detail.state === 'not-started' && await this.startQuest(url)) return this.prepareQuest(url, true);
    return detail;
  }

  async checkOwnedGames(name: string): Promise<boolean> {
    if (name === 'choose-your-own-game') return true;
    const response = await this.request({
      url: `${this.context.baseURL}/ajax/user/steam/quests/check-owned-games/${name}`,
      method: 'GET', headers: { referer: `${this.context.baseURL}/steam/quests/${name}` }
    });
    return response.data?.installed === true;
  }

  async syncGames(url: string): Promise<boolean> {
    const response = await this.request({
      url: url.replace('steam/quests', 'ajax/user/steam/quests/sync-owned-games'), method: 'GET',
      responseType: 'json', headers: { referer: url }
    });
    return response.data?.success === true;
  }

  async selectGame(url: string, gameId: string): Promise<boolean> {
    const response = await this.request({
      url: url.replace('steam/quests', 'ajax/user/steam/quests/start-select-own'), method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8', referer: url }, data: gameId
    });
    return response.status === 200;
  }

  async startQuest(url: string): Promise<boolean> {
    const response = await this.request({
      url: url.replace('steam/quests', 'ajax/user/steam/quests/start'), method: 'GET', headers: { referer: url }
    });
    return response.data?.success === true;
  }

  async getQuestProgress(url: string): Promise<number | null> {
    const response = await this.request({ url, method: 'GET', responseType: 'text', headers: { referer: `${this.context.baseURL}/steam/quests` } });
    const progress = String(response.data).match(/aria-valuenow="([\d]+?)"/)?.[1];
    return progress ? parseInt(progress, 10) : null;
  }
}
