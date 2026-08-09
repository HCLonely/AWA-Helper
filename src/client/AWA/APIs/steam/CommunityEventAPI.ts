/** AWA Steam community-event requests, separate from ASF bot control. */
import type { AxiosResponse } from 'axios';
import { AWAContext } from '../../AWAContext';
import { parseCommunityEvent, parseCommunityEventPath } from '../../parsers';
import type { CommunityEventPage } from '../../types';

export class CommunityEventAPI {
  constructor(private readonly context: AWAContext) {}
  private async get<T = unknown>(url: string): Promise<AxiosResponse<T>> {
    const options: myAxiosConfig = { url, method: 'GET', headers: { ...this.context.headers, referer: this.context.baseURL } };
    if (this.context.httpsAgent) options.httpsAgent = this.context.httpsAgent;
    return this.context.request<T>(options);
  }
  async findPath(): Promise<string | null> {
    const response = await this.get<string>(`${this.context.baseURL}/steam/events`);
    if (String(response.data).includes('concluded')) return null;
    return parseCommunityEventPath(String(response.data));
  }
  async getEvent(path: string): Promise<CommunityEventPage> {
    const response = await this.get<string>(`${this.context.baseURL}/steam/community-event/${path}`);
    return parseCommunityEvent(String(response.data), path);
  }
  async checkOwned(path: string): Promise<boolean> {
    const response = await this.get<{ installed?: boolean }>(`${this.context.baseURL}/ajax/user/steam/community-event/check-owned-games/${path}`);
    return response.data?.installed === true;
  }
  async join(path: string): Promise<boolean> {
    const response = await this.get<{ success?: boolean }>(`${this.context.baseURL}/ajax/user/steam/community-event/start/${path}`);
    return response.data?.success === true;
  }
}
