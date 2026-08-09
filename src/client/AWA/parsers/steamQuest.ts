/** Pure parsers for AWA Steam quest list and detail pages. */
import { load } from 'cheerio';
import type { AWASteamQuestDetail, AWASteamQuestListing } from '../types';

export const parseSteamQuestListings = (html: string, baseURL: string): AWASteamQuestListing[] => {
  const $ = load(html);
  return $('div.container>div.row').toArray().flatMap((row) => {
    const questPath = $(row).find('a.btn-steam-quest[href]').attr('href');
    if (!questPath) return [];
    const link = new URL(questPath, `${baseURL}/`).href;
    const name = link.match(/steam\/quests\/([^/?#]+)/)?.[1];
    if (!name) return [];
    return [{
      name,
      link,
      time: parseInt($(row).find('.media-body p').text()
        .match(/([\d]+)\s*hour/i)?.[1] || '0', 10),
      arp: parseInt($(row).find('.text-steam-light').text()
        .match(/([\d]+)\s*ARP/i)?.[1] || '0', 10)
    }];
  });
};

export const parseSteamQuestDetail = (html: string): AWASteamQuestDetail => {
  const $ = load(html);
  const appId = $('img[src*="steam/apps/"]').first().attr('src')
    ?.match(/steam\/apps\/([\d]+)/)?.[1] ||
    html.match(/steam\/apps\/([\d]+)/)?.[1] || '';
  if (html.includes('You have completed this quest')) return { appId, state: 'completed' };
  if (html.includes('This quest requires that you own')) return { appId, state: 'ownership-required' };
  if (html.includes('Launch Game')) return { appId, state: 'ready' };
  if (html.includes('Sync Games')) return { appId, state: 'selection-required' };
  if (html.includes('Start Quest')) return { appId, state: 'not-started' };
  return { appId, state: 'unknown' };
};

export const parseSelectableSteamGameId = (html: string): string | null => load(html)('#userGames>option').first().attr('value') || null;

export const parseSteamQuestProgress = (html: string): number | null => {
  const progress = html.match(/aria-valuenow="([\d]+?)"/)?.[1];
  return progress ? parseInt(progress, 10) : null;
};
