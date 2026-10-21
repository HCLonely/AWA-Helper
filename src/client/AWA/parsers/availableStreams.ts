/**
 * @file src/client/AWA/parsers/availableStreams.ts
 * @description 解析 AWA 页面内嵌的 Hive、Nexus 及其他可用 Twitch 频道列表。
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
    Nexus: [],
    Other: []
  };
  $('.user-profile__profile-card').filter((_, card) => $(card).find('.user-profile__card-header').text()
    .includes('Watch Twitch'))
    .each((_, card) => {
      // 无标题的后续行沿用当前分类；新卡片默认归入其他频道。
      let category: keyof AvailableStreams = 'Other';
      $(card).find('.user-profile__card-body .row').each((__, row) => {
        const heading = $(row).find('.card-table-heading').text()
          .trim();
        if (heading.includes('Hive')) {
          category = 'Hive';
        } else if (heading.includes('Nexus')) {
          category = 'Nexus';
        } else if (heading) {
          category = 'Other';
        }
        $(row).find('.quest-list__stream-thumbnail a[href]').each((___, link) => {
          const name = $(link).attr('href')?.match(/www\.twitch\.tv\/([^/?]+)/)?.[1];
          if (name && !result[category].includes(name)) {
            result[category].push(name);
          }
        });
      });
    });
  return result;
};
