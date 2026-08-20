/**
 * @file src/client/AWA/parsers/battlePass.ts
 * @description 将 AWA Battle Pass 页面解析为稳定的结构化数据。
 */
import { load, type CheerioAPI } from 'cheerio';
import type { BattlePassRewardState, BattlePassSnapshot, BattlePassStatus } from '../types';

const knownRewardStates = new Set<BattlePassRewardState>(['unlockable', 'claimed', 'in_progress', 'locked']);

/** 等待未开始页面 HTML 样本后补充识别规则。 */
export const isBattlePassNotStarted = (_$: CheerioAPI): boolean => false;

/** 等待已结束页面 HTML 样本后补充识别规则。 */
export const isBattlePassEnded = (_$: CheerioAPI): boolean => false;

const parseInteger = (value?: string): number => {
  const parsed = Number.parseInt(value || '', 10);
  return Number.isFinite(parsed) ? parsed : 0;
};

/**
 * 解析 Battle Pass 页面。
 * @param html - Battle Pass 页面 HTML。
 * @returns 页面状态、代币信息和全部里程碑奖励。
 */
export const parseBattlePass = (html: string): BattlePassSnapshot => {
  const $ = load(html);
  let status: BattlePassStatus = 'unknown';
  if ($('.bp-header__completed').length > 0) {
    status = 'completed';
  } else if (isBattlePassEnded($)) {
    status = 'ended';
  } else if ($('.bp-header__started').length > 0) {
    status = 'active';
  } else if (isBattlePassNotStarted($)) {
    status = 'not-started';
  }

  const rewards = $('.bp-marker[data-milestone-id]').toArray().map((marker) => {
    const element = $(marker);
    const popup = element.find('.bp-popup').first();
    const rawState = element.attr('data-state') || '';
    const state: BattlePassRewardState = knownRewardStates.has(rawState as BattlePassRewardState)
      ? rawState as BattlePassRewardState
      : 'unknown';
    const progressMatch = popup.find('.bp-popup__progress-text').text()
      .trim()
      .match(/(\d+)\s*\/\s*(\d+)/);
    const arpMatch = popup.find('.bp-popup__arp').text().match(/(\d+)\s*ARP/i);
    const form = element.find('form[data-claim-form]').first();
    const path = form.attr('action')?.trim();
    const csrfToken = form.find('input[name="_csrf_token"]').attr('value')?.trim();
    const milestoneId = parseInteger(element.attr('data-milestone-id'));
    return {
      index: parseInteger(element.attr('data-index')),
      milestoneId,
      name: popup.find('.bp-popup__title').text().trim() || element.attr('title')?.trim() || '',
      state,
      image: popup.find('.bp-popup__image').attr('src') || element.find('.bp-marker__image').attr('src'),
      description: popup.find('.bp-popup__desc').text().trim() || undefined,
      requiredArp: arpMatch ? parseInteger(arpMatch[1]) : undefined,
      progress: progressMatch ? { current: parseInteger(progressMatch[1]), total: parseInteger(progressMatch[2]) } : undefined,
      claim: state === 'unlockable' && milestoneId > 0 && path && csrfToken ? { path, csrfToken } : undefined
    };
  });

  const countdown = $('.bp-header__countdown[data-countdown]').attr('data-countdown')?.trim();
  return {
    status,
    claimedCount: rewards.filter((reward) => reward.state === 'claimed').length,
    rewardTotal: rewards.length,
    tokenCount: parseInteger($('.bp-header__token-count').text().trim()),
    tokenTotal: parseInteger($('.bp-header__token-total').text().trim()),
    endsAt: countdown || undefined,
    rewards
  };
};
