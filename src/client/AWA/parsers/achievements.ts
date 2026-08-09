/** Pure parser for the AWA achievement collection page. */
import { load } from 'cheerio';
import type { Achievement } from '../../../types/achievement';

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
          if (description === 'Not Earned Yet') return;
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
