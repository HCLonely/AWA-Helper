/** Remote AWA operations for reading and equipping account artifacts. */
import { http } from '../tools-path';
import { AWAContext } from '../../AWAContext';

export interface EquippedArtifact { id: number; perkTextShort: string }

export class ArtifactAPI {
  constructor(private readonly context: AWAContext) {}

  async getEquipped(userProfilePath: string): Promise<EquippedArtifact[]> {
    const options: myAxiosConfig = {
      url: `${this.context.baseURL}${userProfilePath}/artifacts`, method: 'GET',
      headers: { ...this.context.headers, referer: this.context.baseURL }
    };
    if (this.context.httpsAgent) options.httpsAgent = this.context.httpsAgent;
    const response = await http(options);
    const json = `{${String(response.data).match(/artifactsData.*?=.*?{(.+?)};/m)?.[1] || ''}}`;
    const active = JSON.parse(json)?.userActiveArtifacts as Record<string, EquippedArtifact> | undefined;
    return active ? Object.values(active) : [];
  }

  async equip(userProfilePath: string, artifactId: number, position: number): Promise<boolean> {
    const options: myAxiosConfig = {
      url: `${this.context.baseURL}/change-user-artifacts`, method: 'POST',
      headers: {
        ...this.context.headers, 'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
        origin: this.context.baseURL, referer: `${this.context.baseURL}${userProfilePath}/artifacts`
      },
      data: JSON.stringify({ artifactId: String(artifactId), position: String(position) })
    };
    if (this.context.httpsAgent) options.httpsAgent = this.context.httpsAgent;
    return (await http(options)).status === 200;
  }
}
