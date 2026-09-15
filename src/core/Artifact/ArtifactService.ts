/**
 * @file src/core/Artifact/ArtifactService.ts
 * @description 读取当前 AWA 遗物配置，并按指定槽位完成遗物替换操作。
 */
/* global __ */
import chalk from 'chalk';
import { load } from 'cheerio';
import { getRunConfiguration } from '../../tools/config/RunConfiguration';
import { AWAApiClient } from '../../client/AWA/AWAApiClient';
import { AWAError } from '../../client/AWA/AWAError';
import { getControlCenter, refreshSession } from '../../client/AWA/APIs';
import { Logger, push, time } from '../../tools';

class ArtifactService {
  readonly awa?: AWAApiClient;
  userProfileUrl?: string;
  oldArtifacts: number[] = [];
  activePerks = '';
  initted = true;
  readonly initialCookie: string;

  /**
   * 初始化 Artifact Service 实例。
   * @param configPath - 待读取或写入文件的路径，类型为 `string`。
   */
  constructor(configPath: string) {
    const { awaCookie, awaHost, proxy, UA, debug }: {
      awaCookie?: string; awaHost?: string; proxy?: proxy; UA?: string; debug?: { http?: boolean }
    } = getRunConfiguration(configPath).raw;
    this.initialCookie = awaCookie || '';
    if (!awaCookie) {
      new Logger(time() + chalk.yellow(__('missingAwaCookie')));
      this.initted = false;
      return;
    }
    this.awa = new AWAApiClient({ cookie: awaCookie, host: awaHost, proxy, userAgent: UA, logRequests: debug?.http === true });
  }

  /**
   * 获取 new Cookie。
   * @returns `string`，当前会话序列化后的 Cookie 字符串。
   */
  get newCookie(): string {
    return this.awa?.newCookie || '';
  }

  /**
   * 初始化 init 相关数据。
   * @returns `Promise<boolean>`，表示 init 检查是否通过。
   */
  async init(signal?: AbortSignal): Promise<boolean> {
    if (!this.awa || signal?.aborted) {
      return false;
    }
    new Logger(`${time()}${__('artifactInitializing')}`);
    try {
      await refreshSession(this.awa.context);
      if (signal?.aborted) {
        return false;
      }
      const html = await getControlCenter(this.awa.context);
      const $ = load(html);
      if ($('a.nav-link-login').length) {
        new Logger(`${time()}${__('artifactSessionExpired')}`);
        return false;
      }
      this.userProfileUrl = html.match(/user_profile_url.*?=.*?"(.+?)"/)?.[1];
      new Logger(`${time()}${this.userProfileUrl ? __('artifactInitialized') : __('artifactProfileUrlMissing')}`);
      return !!this.userProfileUrl;
    } catch (error) {
      new Logger(error instanceof AWAError ? error : String(error));
      return false;
    }
  }

  /**
   * 执行 start 相关数据。
   * @param newArtifacts - 准备装备的新遗物标识列表，类型为 `number[]`。
   * @returns `Promise<boolean>`，表示 start 检查是否通过。
   */
  async start(newArtifacts: number[], signal?: AbortSignal): Promise<boolean> {
    new Logger(`${time()}${__('artifactRequestedSet', newArtifacts.join('|'))}`);
    if (newArtifacts.length !== 3 || new Set(newArtifacts).size !== 3 || newArtifacts.some((id) => !Number.isSafeInteger(id) || id <= 0)) {
      return false;
    }
    if (signal?.aborted || !await this.getArtifactsInfo()) {
      return false;
    }
    const oldSet = new Set(this.oldArtifacts);
    const newSet = new Set(newArtifacts);
    const replacements = newArtifacts.filter((artifact) => !oldSet.has(artifact));
    const unchangedPositions = this.oldArtifacts.filter((artifact) => newSet.has(artifact)).map((artifact) => this.oldArtifacts.indexOf(artifact));
    const positions = [0, 1, 2].filter((index) => !unchangedPositions.includes(index)).map((index) => index + 1);
    new Logger(`${time()}${__('artifactReplacementCount', String(replacements.length))}`);
    for (let index = 0; index < positions.length; index++) {
      if (signal?.aborted || !await this.changeArtifact(replacements[index], positions[index])) {
        return false;
      }
    }
    if (signal?.aborted) {
      return false;
    }
    await this.getArtifactsInfo();
    const success = this.oldArtifacts.length === newArtifacts.length &&
      this.oldArtifacts.every((artifact) => newSet.has(artifact));
    new Logger(`${time()}${success ? chalk.green(__('changeArtifactsSuccess')) : chalk.red(__('changeArtifactsFailed'))}`);
    await push(`${success ? __('artifactsStatus') : __('artifactsStatusError')}\n[${this.oldArtifacts.join('|')}]\n\n${__('activePerks')}\n${this.activePerks}`).catch(() => undefined);
    return success;
  }

  /**
   * 获取 get Artifacts Info 相关数据。
   * @returns `Promise<boolean>`，表示 getArtifactsInfo 检查是否通过。
   */
  async getArtifactsInfo(): Promise<boolean> {
    if (!this.awa || !this.userProfileUrl) {
      new Logger(`${time()}${__('artifactNotInitialized')}`);
      return false;
    }
    new Logger(`${time()}${__('artifactLoadingEquipped')}`);
    const artifacts = await this.awa.artifacts.getEquipped(this.userProfileUrl).catch((error) => {
      new Logger(`${time()}${__('artifactLoadFailed', error instanceof Error ? error.name : __('unknownError'))}`);
      return [];
    });
    if (!artifacts.length) {
      new Logger(`${time()}${__('artifactNoEquippedReturned')}`);
      return false;
    }
    this.oldArtifacts = artifacts.map(({ id }) => id);
    this.activePerks = artifacts.map(({ perkTextShort }) => {
      const key = perkTextShort.replace(/\d+/, 's%');
      const value = perkTextShort.match(/\d+/)?.[0] || '';
      return `* ${__(key, value)}`;
    }).join('\n');
    new Logger(`${time()}${__('artifactEquippedSet', this.oldArtifacts.join('|'))}`);
    return true;
  }

  /**
   * 处理 change Artifact 相关逻辑。
   * @param id - 目标资源的唯一标识，类型为 `number`。
   * @param position - 目标遗物所在的装备槽位，类型为 `number`。
   * @returns `Promise<boolean>`，表示 changeArtifact 检查是否通过。
   */
  async changeArtifact(id: number, position: number): Promise<boolean> {
    if (!this.awa || !this.userProfileUrl || !id || !position) {
      new Logger(`${time()}${__('artifactInvalidReplacement', String(position))}`);
      return false;
    }
    const logger = new Logger(`${time()}${__('artifactEquipping', String(id), String(position))}`, false);
    try {
      const result = await this.awa.artifacts.equip(this.userProfileUrl, id, position);
      logger.log(result.ok ? chalk.green(__('logStatusOk')) : chalk.red(`${__('logStatusError')} (${result.state})`));
      return result.ok;
    } catch (error) {
      logger.log(chalk.red(__('logStatusError')));
      new Logger(`${time()}${__('artifactEquipFailed', error instanceof Error ? error.name : __('unknownError'))}`);
      return false;
    }
  }
}

export { ArtifactService };
