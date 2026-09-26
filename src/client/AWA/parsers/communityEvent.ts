/**
 * @file src/client/AWA/parsers/communityEvent.ts
 * @description 解析 AWA Steam 社区活动页面中的进度与奖励信息。
 */
import { load } from 'cheerio';
import type { CommunityEventListing, CommunityEventPage } from '../types';

/**
 * 按页面顺序解析全部社区活动路径并去重。
 * @param html - 待解析的 HTML 文本，类型为 `string`。
 * @returns 社区活动路径列表。
 */
export const parseCommunityEventPaths = (html: string): string[] => [...new Set(load(html)('a[href*="/steam/community-event/"]').toArray()
  .flatMap((element) => {
    const path = element.attribs.href?.match(/\/steam\/community-event\/([^/?#]+)/)?.[1];
    return path ? [path] : [];
  }))];

export const parseCommunityEventPath = (html: string): string | null => parseCommunityEventPaths(html)[0] || null;

/** 仅用于匹配配置的游戏，不替代社区活动元数据。 */
export const communityEventMatchesGame = (html: string, gameId: string): boolean => load(html)('a[href]').toArray()
  .some((element) => element.attribs.href?.match(/^(?:steam:\/\/run\/|https:\/\/store\.steampowered\.com\/app\/)(\d+)(?:[/?#]|$)/)?.[1] === gameId);

/** 控制中心仅提取正在进行的活动横幅，忽略已结束或未开始的活动。 */
export const parseLiveCommunityEvents = (html: string): CommunityEventListing[] => {
  const $ = load(html);
  const events = new Map<string, CommunityEventListing>();
  $('.community-event-banner').each((_index, element) => {
    const banner = $(element);
    if (banner.find('.event-status').text().trim()
      .toUpperCase() !== 'LIVE') {
      return;
    }
    const path = banner.closest('a[href]').attr('href')?.match(/\/steam\/community-event\/([a-z0-9-]+)(?:[/?#]|$)/)?.[1];
    if (path) {
      events.set(path, {
        path,
        title: banner.find('.event-title-date h3').text().trim() || path
      });
    }
  });
  return [...events.values()];
};

/**
 * 解析社区活动信息。
 * @param html - 待解析的 HTML 文本，类型为 `string`。
 * @param path - 待读取或写入文件的路径，类型为 `string`。
 * @returns `CommunityEventPage`，parseCommunityEvent 解析得到的结构化结果。
 */
export const parseCommunityEvent = (html: string, path: string): CommunityEventPage => {
  const $ = load(html);
  return {
    path,
    linkedGameId: $('a[href^="steam://run/"]').attr('href')?.match(/^steam:\/\/run\/(\d+)(?:[/?#]|$)/)?.[1],
    concluded: html.includes('concluded'),
    closed: html.includes('EVENT IS CLOSED'),
    owned: !$('.btn-check-owned-games,#sync-button').length,
    joined: !$('a.enter-event-btn').length,
    playedMinutes: parseInt(html.match(/personalPlaytime.*?=.*?([\d]+)/)?.[1] || $('.progress-bar.bg-info').eq(-2).attr('aria-valuenow') || '0', 10),
    totalMinutes: parseInt($('.progress-bar.bg-info').eq(-2).attr('aria-valuemax') || '0', 10)
  };
};
