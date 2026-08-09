/**
 * @file src/client/Steam/SteamClient.ts
 * @description 聚合 ASF 会话、机器人、命令和许可证接口，供 Steam 任务编排调用。
 */
import { ASFContext } from './ASFContext';
import { addLicense, getOwnedGames, getStatus, playGames, stopGames, verifyConnection } from './APIs';
import chalk from 'chalk';
import { Logger, time } from '../../tools';
import type { ASFBotTaskState } from './types';

export class SteamClient {
  readonly context: ASFContext;
  status: ASFBotTaskState = 'none';

  /**
   * 初始化 Steam Client 实例。
   * @param options - 创建实例或执行操作所需的配置选项，类型为 `{ asfProtocol: string; asfHost: string; asfPort: number; asfPassword?: string; asfBotname: string; proxy?: proxy; }`。
   */
  constructor({ asfProtocol, asfHost, asfPort, asfPassword = '', asfBotname, proxy }: {
    asfProtocol: string; asfHost: string; asfPort: number; asfPassword?: string; asfBotname: string; proxy?: proxy
  }) {
    this.context = new ASFContext({
      protocol: asfProtocol, host: asfHost, port: asfPort, password: asfPassword, botName: asfBotname, proxy
    });
  }

  /**
   * 初始化 init 相关数据。
   * @returns `Promise<boolean>`，表示 init 检查是否通过。
   */
  async init(): Promise<boolean> {
    const logger = new Logger(`${time()}${__('initing', chalk.yellow('ASF'))}`, false);
    try {
      const connected = await verifyConnection(this.context);
      logger.log(connected ? chalk.green('OK') : chalk.red('Error'));
      return connected;
    } catch (error) {
      logger.log(chalk.red('Error'));
      new Logger(error);
      return false;
    }
  }
  /**
   * 获取 session。
   * @returns `{ verify: () => Promise<boolean>; getStatus: () => Promise<string>; }`，session 相关操作组成的 API 集合。
   */
  get session() {
    return {
      /**
       * 检查 verify 相关数据。
       * @returns `Promise<boolean>`，表示 verify 检查是否通过。
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
       * @returns `Promise<boolean>`，表示 playGames 检查是否通过。
       */
      playGames: (appIds: string[]) => this.playGames(appIds),
      /**
       * 停止 stop Games 相关数据。
       * @returns `Promise<boolean>`，表示 stopGames 检查是否通过。
       */
      stopGames: () => this.resume()
    };
  }
  /**
   * 获取 licenses。
   * @returns `{ add: (appIds: string[]) => Promise<boolean>; }`，licenses 相关操作组成的 API 集合。
   */
  get licenses() {
    return {
      /**
       * 添加 add 相关数据。
       * @param appIds - 需要处理的 Steam 应用标识列表，类型为 `string[]`。
       * @returns `Promise<boolean>`，表示 add 检查是否通过。
       */
      add: (appIds: string[]) => addLicense(this.context, appIds)
    };
  }
  /**
   * 获取 get Owned Games 相关数据。
   * @param appIds - 需要处理的 Steam 应用标识列表，类型为 `string[]`。
   * @returns `Promise<string[]>`，getOwnedGames 收集或筛选得到的数据列表。
   */
  getOwnedGames(appIds: string[]): Promise<string[]> { return getOwnedGames(this.context, appIds); }
  /**
   * 添加 add License 相关数据。
   * @param appIds - 需要处理的 Steam 应用标识列表，类型为 `string[]`。
   * @returns `Promise<boolean>`，表示 addLicense 检查是否通过。
   */
  addLicense(appIds: string[]): Promise<boolean> { return addLicense(this.context, appIds); }
  /**
   * 处理 play Games 相关逻辑。
   * @param appIds - 需要处理的 Steam 应用标识列表，类型为 `string[]`。
   * @returns `Promise<boolean>`，表示 playGames 检查是否通过。
   */
  async playGames(appIds: string[]): Promise<boolean> {
    const started = await playGames(this.context, appIds);
    if (started) this.status = 'running';
    return started;
  }
  /**
   * 处理 resume 相关逻辑。
   * @returns `Promise<boolean>`，表示 resume 检查是否通过。
   */
  async resume(): Promise<boolean> {
    if (this.status === 'stopped') return true;
    const logger = new Logger(`${time()}${__('stoppingPlayingGames')}`, false);
    try {
      const resumed = await stopGames(this.context);
      if (resumed) this.status = 'stopped';
      logger.log(resumed ? chalk.green('OK') : chalk.red('Error'));
      return resumed;
    } catch (error) {
      logger.log(chalk.red('Error'));
      new Logger(error);
      return false;
    }
  }
}
