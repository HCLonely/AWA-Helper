/**
 * @file src/client/AWA/parsers/steamQuest.ts
 * @description 解析 AWA Steam 任务列表、详情和进度数据。
 */
import { load } from 'cheerio';
import type { AWASteamQuestDetail, AWASteamQuestListing } from '../types';

/**
 * 解析 Steam 任务列表。
 * @param html - 待解析的 HTML 文本，类型为 `string`。
 * @param baseURL - 目标资源或服务的 URL，类型为 `string`。
 * @returns `AWASteamQuestListing[]`，parseSteamQuestListings 收集或筛选得到的数据列表。
 */
export const parseSteamQuestListings = (html: string, baseURL: string): AWASteamQuestListing[] => {
  const $ = load(html);
  return $('div.container>div.row').toArray().flatMap((row) => {
    const questPath = $(row).find('a.btn-steam-quest[href]').attr('href');
    if (!questPath) {
      return [];
    }
    const link = new URL(questPath, `${baseURL}/`).href;
    const name = link.match(/steam\/quests\/([^/?#]+)/)?.[1];
    if (!name) {
      return [];
    }
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

/**
 * 解析 Steam 任务详情。
 * @param html - 待解析的 HTML 文本，类型为 `string`。
 * @returns `AWASteamQuestDetail`，parseSteamQuestDetail 解析得到的结构化结果。
 */
export const parseSteamQuestDetail = (html: string): AWASteamQuestDetail => {
  const $ = load(html);
  const appId = $('img[src*="steam/apps/"]').first().attr('src')
    ?.match(/steam\/apps\/([\d]+)/)?.[1] ||
    html.match(/steam\/apps\/([\d]+)/)?.[1] || '';
  if (html.includes('You have completed this quest')) {
    return {
      appId,
      state: 'completed'
    };
  }
  if (html.includes('This quest requires that you own')) {
    return {
      appId,
      state: 'ownership-required'
    };
  }
  if (html.includes('Launch Game')) {
    return {
      appId,
      state: 'ready'
    };
  }
  if (html.includes('Sync Games')) {
    return {
      appId,
      state: 'selection-required'
    };
  }
  if (html.includes('Start Quest')) {
    return {
      appId,
      state: 'not-started'
    };
  }
  return {
    appId,
    state: 'unknown'
  };
};

/**
 * 解析可选 Steam 游戏标识。
 * @param html - 待解析的 HTML 文本，类型为 `string`。
 * @returns `string | null`，parseSelectableSteamGameId 解析得到的结构化结果。
 */
export const parseSelectableSteamGameId = (html: string): string | null => load(html)('#userGames>option').first().attr('value') || null;

/**
 * 解析 Steam 任务进度。
 * @param html - 待解析的 HTML 文本，类型为 `string`。
 * @returns `number | null`，parseSteamQuestProgress 解析得到的结构化结果。
 */
export const parseSteamQuestProgress = (html: string): number | null => {
  const progress = html.match(/aria-valuenow="([\d]+?)"/)?.[1];
  return progress ? parseInt(progress, 10) : null;
};
