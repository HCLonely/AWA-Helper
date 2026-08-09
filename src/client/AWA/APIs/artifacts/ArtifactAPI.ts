/**
 * @file src/client/AWA/APIs/artifacts/ArtifactAPI.ts
 * @description 封装读取、定位和装备 AWA 账户遗物的远程操作。
 */
import { AWAContext } from '../../AWAContext';
import { parseEquippedArtifacts, type EquippedArtifact } from '../../parsers';
import type { ActionResult } from '../../../shared';
export type { EquippedArtifact } from '../../parsers';

export class ArtifactAPI {
  /**
   * 初始化 Artifact API 实例。
   * @param context - 发起远程请求及保存会话状态所需的客户端上下文，类型为 `AWAContext`。
   */
  constructor(private readonly context: AWAContext) {}

  /**
   * 获取 get Equipped 相关数据。
   * @param userProfilePath - 待读取或写入文件的路径，类型为 `string`。
   * @returns `Promise<EquippedArtifact[]>`，getEquipped 收集或筛选得到的数据列表。
   */
  async getEquipped(userProfilePath: string): Promise<EquippedArtifact[]> {
    const options: myAxiosConfig = {
      url: `${this.context.baseURL}${userProfilePath}/artifacts`, method: 'GET',
      headers: { ...this.context.headers, referer: this.context.baseURL }
    };
    if (this.context.httpsAgent) options.httpsAgent = this.context.httpsAgent;
    const response = await this.context.request<string>(options);
    return parseEquippedArtifacts(response.data);
  }

  /**
   * 处理 equip 相关逻辑。
   * @param userProfilePath - 待读取或写入文件的路径，类型为 `string`。
   * @param artifactId - 目标资源的唯一标识，类型为 `number`。
   * @param position - 目标遗物所在的装备槽位，类型为 `number`。
   * @returns 装备成功时返回 `equipped`，远程拒绝时返回 `rejected`。
   */
  async equip(userProfilePath: string, artifactId: number, position: number): Promise<ActionResult<'equipped', 'rejected'>> {
    const options: myAxiosConfig = {
      url: `${this.context.baseURL}/change-user-artifacts`, method: 'POST',
      headers: {
        ...this.context.headers, 'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
        origin: this.context.baseURL, referer: `${this.context.baseURL}${userProfilePath}/artifacts`
      },
      data: JSON.stringify({ artifactId: String(artifactId), position: String(position) })
    };
    if (this.context.httpsAgent) options.httpsAgent = this.context.httpsAgent;
    return (await this.context.request(options)).status === 200
      ? { ok: true, state: 'equipped' }
      : { ok: false, state: 'rejected' };
  }
}
