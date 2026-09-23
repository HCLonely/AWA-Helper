/**
 * @file src/client/AWA/parsers/availableStreams.ts
 * @description 解析 AWA 页面内嵌的 Hive 与 Nexus Twitch 频道列表。
 */
import { load } from 'cheerio';
import type { AvailableStreams } from '../../../types/achievement';

/**
 * 解析可用直播列表。
 * @param html - 待解析的 HTML 文本，类型为 `string`。
 * @returns `AvailableStreams`，parseAvailableStreams 解析得到的结构化结果。
 */
export const parseAvailableStreams = (html: string): AvailableStreams => {
  const $ = load(html);
  const result: AvailableStreams = {
    Hive: [],
    Nexus: []
  };
  let category: keyof AvailableStreams | null = null;
  $('.user-profile__profile-card').filter((_, card) => $(card).find('.user-profile__card-header').text()
    .includes('Watch Twitch'))
    .find('.user-profile__card-body .row')
    .each((_, row) => {
      const heading = $(row).find('.card-table-heading').text();
      if (heading.includes('Hive')) {
        category = 'Hive';
      } else if (heading.includes('Nexus')) {
        category = 'Nexus';
      } else if (heading) {
        category = null;
      }
      if (!category) {
        return;
      }
      $(row).find('.quest-list__stream-thumbnail a[href]').each((__, link) => {
        const name = $(link).attr('href')?.match(/www\.twitch\.tv\/([^/?]+)/)?.[1];
        if (name && !result[category!].includes(name)) {
          result[category!].push(name);
        }
      });
    });
  return result;
};
