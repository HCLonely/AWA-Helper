/**
 * @file src/client/Steam/SteamClient.ts
 * @description 聚合 ASF 会话、机器人、命令和许可证接口，供 Steam 任务编排调用。
 */
import { ASFContext } from './ASFContext';
import { addLicense, getOwnedGames, getStatus, playGames, stopGames, verifyConnection } from './APIs';

export class SteamClient {
  readonly context: ASFContext;

  /**
   * 初始化 Steam Client 实例。
   * @param options - 创建实例或执行操作所需的配置选项，类型为 `{ asfProtocol: string; asfHost: string; asfPort: number; asfPassword?: string; asfBotname: string; proxy?: proxy; }`。
   */
  constructor({ asfProtocol, asfHost, asfPort, asfPassword = '', asfBotname, proxy, logRequests }: {
    asfProtocol: string; asfHost: string; asfPort: number; asfPassword?: string; asfBotname: string; proxy?: proxy; logRequests?: boolean
  }) {
    this.context = new ASFContext({
      protocol: asfProtocol, host: asfHost, port: asfPort, password: asfPassword, botName: asfBotname, proxy, logRequests
    });
  }

  /**
   * 获取 session。
   * @returns ASF 连接验证和原始状态查询 API 集合。
   */
  get session() {
    return {
      /**
       * 检查 verify 相关数据。
       * @returns 包含 `connected` 或 `empty-response` 状态的结构化结果。
       */
      verify: () => verifyConnection(this.context),
      /**
       * 获取 get Status 相关数据。
       * @returns `Promise<string>`，getStatus 获取或生成的文本内容。
       */
      getStatus: () => getStatus(this.context)
    };
  }
  /**
   * 获取 bot。
   * @returns `object`，bot 相关操作组成的 API 集合。
   */
  get bot() {
    return {
      /**
       * 获取 get Owned Games 相关数据。
       * @param appIds - 需要处理的 Steam 应用标识列表，类型为 `string[]`。
       * @returns `Promise<string[]>`，getOwnedGames 收集或筛选得到的数据列表。
       */
      getOwnedGames: (appIds: string[]) => getOwnedGames(this.context, appIds),
      /**
       * 处理 play Games 相关逻辑。
       * @param appIds - 需要处理的 Steam 应用标识列表，类型为 `string[]`。
       * @returns 包含 `started` 或 `no-games` 状态的结构化结果。
       */
      playGames: (appIds: string[]) => playGames(this.context, appIds),
      /**
       * 停止 stop Games 相关数据。
       * @returns ASF Bot 恢复后的 `resumed` 结果。
       */
      stopGames: () => stopGames(this.context)
    };
  }
  /**
   * 获取 licenses。
   * @returns ASF 应用许可证操作 API 集合。
   */
  get licenses() {
    return {
      /**
       * 添加 add 相关数据。
       * @param appIds - 需要处理的 Steam 应用标识列表，类型为 `string[]`。
       * @returns 包含 `added` 或 `not-required` 状态的结构化结果。
       */
      add: (appIds: string[]) => addLicense(this.context, appIds)
    };
  }
}
