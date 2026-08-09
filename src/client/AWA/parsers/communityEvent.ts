/** Pure parser for an AWA Steam community-event page. */
import { load } from 'cheerio';
import type { CommunityEventPage } from '../types';

export const parseCommunityEventPath = (html: string): string | null => load(html)('a[href*="/steam/community-event"]').attr('href')?.split('/')
  .at(-1) || null;

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
