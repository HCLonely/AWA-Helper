/**
 * @file src/client/AWA/parsers/achievements.ts
 * @description 解析 AWA 成就收藏页面中的成就名称、描述和完成状态。
 */
import { load } from 'cheerio';
import type { Achievement } from '../../../types/achievement';

/**
 * 解析成就列表。
 * @param html - 待解析的 HTML 文本，类型为 `string`。
 * @returns `Achievement[]`，parseAchievements 收集或筛选得到的数据列表。
 */
export const parseAchievements = (html: string): Achievement[] => {
  const $ = load(html);
  const achievements: Achievement[] = [];
  $('.achievement-cards-collection-tab').each((_, container) => {
    $(container).find('.stack-title').each((__, header) => {
      const category = $(header).text().trim() || 'Unknown';
      $(header).next().find('.achievement-card')
        .each((index, card) => {
          const description = $(card).find('.achievement-description-text').text()
            .trim();
          if (description === 'Not Earned Yet') {
            return;
          }
          achievements.push({
            id: `${category}-${index}`,
            name: `${category} ${index + 1}`,
            completed: !$(card).hasClass('unachieved'),
            description
          });
        });
    });
  });
  return achievements;
};
