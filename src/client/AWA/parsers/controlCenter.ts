/**
 * @file src/client/AWA/parsers/controlCenter.ts
 * @description 解析 AWA 控制中心页面中的任务、签到、积分和用户状态。
 */
import { load } from 'cheerio';
import type { ControlCenterSnapshot, PromotionalCalendarEntry } from '../types';
export type { ControlCenterSnapshot } from '../types';

/**
 * 解析 parse Control Center 相关数据。
 * @param html - 待解析的 HTML 文本，类型为 `string`。
 * @param baseURL - 目标资源或服务的 URL，类型为 `string`。
 * @returns `ControlCenterSnapshot`，parseControlCenter 解析得到的结构化结果。
 */
export const parseControlCenter = (html: string, baseURL: string): ControlCenterSnapshot => {
  const $ = load(html);
  const rewardBonusArp = html.match(/bonusCalendarArp.*?=.*?([\d]+?)/)?.[1] || '';
  const signArp: ControlCenterSnapshot['signArp'] = {};
  const consecutive = html.match(/consecutive_logins.*?=.*?({.+?})/)?.[1];
  if (consecutive) {
    try {
      const data = JSON.parse(consecutive);
      const reward = $(`#streak-days .calendar-rewards__day[data-day="${data.count}"] .calendar-rewards__reward span`).text().trim();
      if (reward) {
        signArp.daily = `${reward} + ${rewardBonusArp} ARP`;
      }
    } catch (_error) { /* malformed optional page data */ }
  }
  const monthly = html.match(/monthly_logins.*?=.*?({.+?})/)?.[1];
  if (monthly) {
    try {
      const data = JSON.parse(monthly);
      if (data.count < 29) {
        const week = Math.ceil(data.count / 7);
        const day = $(`#monthly-days-${week} .calendar-rewards__day[data-day="${data.count}"]`);
        const reward = day.find('.calendar-rewards__reward span').text().trim();
        const item = day.find('.calendar-rewards__reward img[data-bs-title]').attr('data-bs-title')?.trim();
        if (reward) {
          signArp.monthly = `${reward} + ${rewardBonusArp} ARP`;
        }
        if (item) {
          signArp.monthly = item;
        }
      } else {
        signArp.monthly = `${data.extra_arp} + ${rewardBonusArp} ARP`;
      }
    } catch (_error) { /* malformed optional page data */ }
  }

  const questInfo: questInfo = { timeOnSite: { maxArp: '5', addedArp: '0', addedArpExtra: '0' } };
  let dailyArp = '0';
  const dailyData = html.match(/dailyArpData.*?=.*?({.+?}})/)?.[1];
  if (dailyData) {
    try {
      const data = JSON.parse(dailyData);
      questInfo.timeOnSite = { maxArp: `${data.timeOnSiteCap}`, addedArp: `${data.timeOnSiteArp}`, addedArpExtra: '0' };
      questInfo.watchTwitch = [`${data.twitchData.totalPoints}`, `${data.twitchData.bonusPoints}`];
      dailyArp = `${data.dailyArp}`;
    } catch (_error) { /* defaults remain valid */ }
  }

  const bodies = $('div.user-profile__card-body');
  questInfo.dailyQuestUS = bodies.eq(0).find('.card-table-row').filter((_, row) => $(row).find('a[href^="/quests/"]').length > 0)
    .toArray()
    .map((row) => {
      const progress = $(row).find('.quest-item-progress,a.text-info').toArray()
        .map((item) => $(item).text().trim()
          .toLowerCase())
        .at(-1)
        ?.match(/[\d\s+]+/)?.[0].split('+') || [];
      return {
        link: new URL($(row).find('a[href^="/quests/"]').attr('href') || '/', `${baseURL}/`).href,
        title: $(row).find('.quest-title').text()
          .trim(),
        arp: progress[0]?.trim() || '0',
        extraArp: progress[1]?.trim() || '0'
      };
    });
  questInfo.dailyQuest = bodies.eq(0).find('.card-table-row').filter((_, row) => $(row).find('a[href^="/quests/"]').length === 0)
    .toArray()
    .map((row) => {
      const progress = $(row).find('.quest-item-progress').toArray()
        .map((item) => $(item).text().trim()
          .toLowerCase());
      return {
        status: progress[0] || '',
        arp: progress[1] || '0 ARP',
        name: $(row).find('.quest-title').first()
          .text()
          .trim(),
        id: $(row).find('a.quest-title[data-award-on-click="true"][href]').filter((_, link) => !/^\/quests\//.test($(link).attr('href') || ''))
          .attr('data-quest-id')
      };
    });
  questInfo.steamQuest = bodies.eq(1).find('.card-table-row').toArray()
    .map((row) => ({
      name: $(row).find('.quest-list__quest-details div').first()
        .text()
        .trim(),
      status: $(row).find('[id^=control-center__steam-quest-status-]').text()
        .trim()
        .toLowerCase(),
      maxAvailableARP: $(row).find('[id^=control-center__steam-quest-reward-]').text()
        .match(/[\d\s+]+/)?.[0].trim() || '0'
    }));

  const promoDays = $('div.promotional-calendar__day');
  let promotionalCalendarInfo: PromotionalCalendarEntry[] | undefined;
  const claimable = promoDays.filter((_, day) => $(day).text().includes('GET ITEM'));
  if (claimable.length) {
    promotionalCalendarInfo = claimable.toArray().map((day) => ({
      name: $(day).find('.promotional-calendar__day-info h1').text()
        .trim(), day: `Day ${$(day).attr('data-day')}`, finished: false
    }));
  } else {
    promotionalCalendarInfo = promoDays.filter((_, day) => $(day).text().includes('My Rewards')).last().toArray()
      .map((day) => ({
        name: $(day).find('.promotional-calendar__day-info h1').text()
          .trim(), day: `Day ${$(day).attr('data-day')}`, finished: true
      }));
  }

  return {
    questInfo, dailyArp, signArp, promotionalCalendarInfo,
    userProfileUrl: html.match(/user_profile_url.*?=.*?"(.+?)"/)?.[1],
    taskType: html.match(/user_country.*?=.*?"(.+?)"/)?.[1] === 'US' ? 'US' : 'New',
    posts: $('.featured-row-News a[href*="/ucf/show/"]').toArray().flatMap((link) => $(link).attr('href')?.match(/ucf\/show\/([\d]+)/)?.[1] || []),
    dailyQuestLink: $('a.quest-title[href]').first().attr('href') ? new URL($('a.quest-title[href]').first().attr('href')!, `${baseURL}/`).href : undefined,
    getStartedItems: $('.onboarding_items .onboarding_item').has('i.fa-square').toArray()
      .map((item) => ({
        name: $(item).find('a.onboarding-link').text()
          .trim(), link: $(item).find('a.onboarding-link').attr('href') || ''
      }))
      .filter(({ link }) => !!link)
  };
};
