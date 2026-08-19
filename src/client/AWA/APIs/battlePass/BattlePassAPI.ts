/**
 * @file src/client/AWA/APIs/battlePass/BattlePassAPI.ts
 * @description 获取 AWA Battle Pass 页面并领取可解锁里程碑奖励。
 */
import FormData from 'form-data';
import { AWAContext } from '../../AWAContext';
import { parseBattlePass } from '../../parsers';
import type { BattlePassClaimResult, BattlePassClaimSuccess, BattlePassReward, BattlePassSnapshot } from '../../types';

export class BattlePassAPI {
  /**
   * 初始化 Battle Pass API。
   * @param context - AWA 请求上下文。
   */
  constructor(private readonly context: AWAContext) {}

  /**
   * 获取并解析 Battle Pass 页面。
   * @param url - Control Center 中发现的 Battle Pass 页面 URL。
   * @returns Battle Pass 页面快照。
   */
  async getPage(url: string): Promise<BattlePassSnapshot> {
    const target = this.resolveSameOriginUrl(url);
    if (!target) {
      throw new Error('Battle Pass URL must use the configured AWA origin');
    }
    const options: myAxiosConfig = {
      url: target.href, method: 'GET', headers: { ...this.context.headers, referer: `${this.context.baseURL}/control-center` }
    };
    if (this.context.httpsAgent) {
      options.httpsAgent = this.context.httpsAgent;
    }
    const response = await this.context.request<string>(options);
    this.context.updateCookies(response.headers?.['set-cookie']);
    return parseBattlePass(String(response.data));
  }

  /**
   * 领取一个可解锁的 Battle Pass 奖励。
   * @param battlePassUrl - 当前 Battle Pass 页面 URL，用作 Referer。
   * @param reward - 带有领取路径和 CSRF Token 的奖励。
   * @returns 经响应字段与里程碑 ID 校验后的领取结果。
   */
  async claim(battlePassUrl: string, reward: BattlePassReward): Promise<BattlePassClaimResult> {
    const referer = this.resolveSameOriginUrl(battlePassUrl);
    const target = reward.claim ? this.resolveSameOriginUrl(reward.claim.path) : undefined;
    if (!referer || !target || !reward.claim || reward.state !== 'unlockable' || reward.milestoneId <= 0) {
      return { ok: false, reason: 'invalid-request' };
    }
    const form = new FormData();
    form.append('_csrf_token', reward.claim.csrfToken);
    const options: myAxiosConfig = {
      url: target.href,
      method: 'POST',
      data: form,
      headers: { ...this.context.headers, ...form.getHeaders(), origin: this.context.baseURL, referer: referer.href }
    };
    if (this.context.httpsAgent) {
      options.httpsAgent = this.context.httpsAgent;
    }
    const response = await this.context.request<Partial<BattlePassClaimSuccess>>(options);
    this.context.updateCookies(response.headers?.['set-cookie']);
    if (response.data?.success !== true) {
      return { ok: false, reason: 'rejected' };
    }
    if (response.data.milestoneId !== reward.milestoneId || typeof response.data.userMilestoneId !== 'number') {
      return { ok: false, reason: 'milestone-mismatch' };
    }
    return { ok: true, data: response.data as BattlePassClaimSuccess };
  }

  private resolveSameOriginUrl(url: string): URL | undefined {
    try {
      const target = new URL(url, `${this.context.baseURL}/`);
      return target.origin === new URL(this.context.baseURL).origin ? target : undefined;
    } catch (_error) {
      return undefined;
    }
  }
}
