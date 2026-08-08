/** Reads and parses achievements for the current AWA account. */
import { load } from 'cheerio';
import { http } from '../tools-path';
import { AWAContext } from '../../AWAContext';
import { AWAError } from '../../AWAError';
import type { Achievement } from '../../../../types/achievement';

export const getAchievements = async (context: AWAContext): Promise<Achievement[]> => {
  if (!context.username) throw new AWAError('getAchievements', 'AWA username is not initialized');
  const options: myAxiosConfig = { url: `${context.baseURL}/member/${context.username}/achievements`, method: 'GET', headers: context.headers };
  if (context.httpsAgent) options.httpsAgent = context.httpsAgent;
  const response = await http(options);
  const $ = load(response.data);
  const achievements: Achievement[] = [];
  $('.achievement-cards-collection-tab').each((_, container) => {
    $(container).find('.stack-title').each((__, header) => {
      const category = $(header).text().trim() || 'Unknown';
      $(header).next().find('.achievement-card')
        .each((index, card) => {
          const description = $(card).find('.achievement-description-text').text()
            .trim();
          if (description === 'Not Earned Yet') return;
          achievements.push({ id: `${category}-${index}`, name: `${category} ${index + 1}`, completed: !$(card).hasClass('unachieved'), description });
        });
    });
  });
  return achievements;
};
