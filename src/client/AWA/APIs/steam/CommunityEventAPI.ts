/** AWA Steam community-event requests, separate from ASF bot control. */
import { load } from 'cheerio';
import { http } from '../tools-path';
import { AWAContext } from '../../AWAContext';

export interface CommunityEventPage {
  path?: string; concluded: boolean; closed: boolean; gameId?: string; gameName?: string;
  started: boolean; playedMinutes: number; totalMinutes: number;
}

export class CommunityEventAPI {
  constructor(private readonly context: AWAContext) {}
  private async get(url: string): Promise<any> {
    const options: myAxiosConfig = { url, method: 'GET', headers: { ...this.context.headers, referer: this.context.baseURL } };
    if (this.context.httpsAgent) options.httpsAgent = this.context.httpsAgent;
    return http(options);
  }
  async findPath(): Promise<string | null> {
    const response = await this.get(`${this.context.baseURL}/steam/events`);
    if (String(response.data).includes('concluded')) return null;
    return load(response.data)('a[href*="/steam/community-event"]').attr('href')?.split('/')
      .at(-1) || null;
  }
  async getEvent(path: string): Promise<CommunityEventPage> {
    const response = await this.get(`${this.context.baseURL}/steam/community-event/${path}`);
    const html = String(response.data);
    const $ = load(html);
    return {
      path, concluded: html.includes('concluded'), closed: html.includes('EVENT IS CLOSED'),
      gameId: $('a.btn-steam-community-event[href^="steam://run/"]').attr('href')?.match(/[\d]+/)?.[0],
      gameName: $('h1').first().text()
        .trim(), started: !$('.btn-check-owned-games').length,
      playedMinutes: parseInt(html.match(/personalPlaytime.*?=.*?([\d]+)/)?.[1] || $('.progress-bar.bg-info').eq(-2).attr('aria-valuenow') || '0', 10),
      totalMinutes: parseInt($('.progress-bar.bg-info').eq(-2).attr('aria-valuemax') || '0', 10)
    };
  }
  async checkOwned(path: string): Promise<boolean> {
    const response = await this.get(`${this.context.baseURL}/ajax/user/steam/community-event/check-owned-games/${path}`);
    return response.data?.installed === true;
  }
  async join(path: string): Promise<boolean> {
    const response = await this.get(`${this.context.baseURL}/ajax/user/steam/community-event/start/${path}`);
    return response.data?.success === true;
  }
}
