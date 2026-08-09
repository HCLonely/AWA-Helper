/** Manager-owned orchestration for reading and replacing AWA artifacts. */
/* global __ */
import * as fs from 'fs';
import chalk from 'chalk';
import { load } from 'cheerio';
import { parse } from 'yaml';
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

  constructor(configPath: string) {
    const { awaCookie, awaHost, proxy, UA }: { awaCookie?: string; awaHost?: string; proxy?: proxy; UA?: string } = parse(fs.readFileSync(configPath, 'utf8'));
    if (!awaCookie) {
      new Logger(time() + chalk.yellow(__('missingAwaCookie')));
      this.initted = false;
      return;
    }
    this.awa = new AWAApiClient({ cookie: awaCookie, host: awaHost, proxy, userAgent: UA });
  }

  get newCookie(): string { return this.awa?.newCookie || ''; }

  async init(): Promise<boolean> {
    if (!this.awa) return false;
    try {
      await refreshSession(this.awa.context);
      const html = await getControlCenter(this.awa.context);
      const $ = load(html);
      if ($('a.nav-link-login').length) return false;
      this.userProfileUrl = html.match(/user_profile_url.*?=.*?"(.+?)"/)?.[1];
      return !!this.userProfileUrl;
    } catch (error) {
      new Logger(error instanceof AWAError ? error : String(error));
      return false;
    }
  }

  async start(newArtifacts: number[]): Promise<boolean> {
    if (!await this.getArtifactsInfo()) return false;
    const oldSet = new Set(this.oldArtifacts);
    const newSet = new Set(newArtifacts);
    const replacements = newArtifacts.filter((artifact) => !oldSet.has(artifact));
    const unchangedPositions = this.oldArtifacts.filter((artifact) => newSet.has(artifact)).map((artifact) => this.oldArtifacts.indexOf(artifact));
    const positions = [0, 1, 2].filter((index) => !unchangedPositions.includes(index)).map((index) => index + 1);
    for (let index = 0; index < positions.length; index++) {
      if (!await this.changeArtifact(replacements[index], positions[index])) return false;
    }
    await this.getArtifactsInfo();
    const success = this.oldArtifacts.every((artifact) => newSet.has(artifact));
    new Logger(`${time()}${success ? chalk.green(__('changeArtifactsSuccess')) : chalk.red(__('changeArtifactsFailed'))}`);
    await push(`${success ? __('artifactsStatus') : __('artifactsStatusError')}\n[${this.oldArtifacts.join('|')}]\n\n${__('activePerks')}\n${this.activePerks}`).catch(() => undefined);
    return success;
  }

  async getArtifactsInfo(): Promise<boolean> {
    if (!this.awa || !this.userProfileUrl) return false;
    const artifacts = await this.awa.artifacts.getEquipped(this.userProfileUrl).catch(() => []);
    if (!artifacts.length) return false;
    this.oldArtifacts = artifacts.map(({ id }) => id);
    this.activePerks = artifacts.map(({ perkTextShort }) => {
      const key = perkTextShort.replace(/\d+/, 's%');
      const value = perkTextShort.match(/\d+/)?.[0] || '';
      return `* ${__(key, value)}`;
    }).join('\n');
    return true;
  }

  async changeArtifact(id: number, position: number): Promise<boolean> {
    if (!this.awa || !this.userProfileUrl || !id || !position) return false;
    return this.awa.artifacts.equip(this.userProfileUrl, id, position);
  }
}

export { ArtifactService };
