/**
 * @file src/client/AWA/parsers/communityEvent.ts
 * @description 解析 AWA Steam 社区活动页面中的进度与奖励信息。
 */
import { load } from 'cheerio';
import type { CommunityEventPage } from '../types';

/**
 * 解析 parse Community Event Path 相关数据。
 * @param html - 待解析的 HTML 文本，类型为 `string`。
 * @returns `string | null`，parseCommunityEventPath 解析得到的结构化结果。
 */
export const parseCommunityEventPath = (html: string): string | null => load(html)('a[href*="/steam/community-event"]').attr('href')?.split('/')
  .at(-1) || null;

/**
 * 解析 parse Community Event 相关数据。
 * @param html - 待解析的 HTML 文本，类型为 `string`。
 * @param path - 待读取或写入文件的路径，类型为 `string`。
 * @returns `CommunityEventPage`，parseCommunityEvent 解析得到的结构化结果。
 */
export const parseCommunityEvent = (html: string, path: string): CommunityEventPage => {
  const $ = load(html);
  return {
    path,
    concluded: html.includes('concluded'),
    closed: html.includes('EVENT IS CLOSED'),
    gameId: $('a.btn-steam-community-event[href^="steam://run/"]').attr('href')?.match(/[\d]+/)?.[0],
    gameName: $('h1').first().text()
      .trim(),
    started: !$('.btn-check-owned-games').length,
    playedMinutes: parseInt(html.match(/personalPlaytime.*?=.*?([\d]+)/)?.[1] || $('.progress-bar.bg-info').eq(-2).attr('aria-valuenow') || '0', 10),
    totalMinutes: parseInt($('.progress-bar.bg-info').eq(-2).attr('aria-valuemax') || '0', 10)
  };
};
