/** Reads Hive and Nexus stream names from the AWA control center. */
import { load } from 'cheerio';
import { http } from '../tools-path';
import { AWAContext } from '../../AWAContext';
import type { AvailableStreams } from '../../../../types/achievement';

export const getAvailableStreams = async (context: AWAContext): Promise<AvailableStreams> => {
  const options: myAxiosConfig = { url: `${context.baseURL}/control-center`, method: 'GET', headers: context.headers };
  if (context.httpsAgent) options.httpsAgent = context.httpsAgent;
  const response = await http(options);
  const $ = load(response.data);
  const result: AvailableStreams = { Hive: [], Nexus: [] };
  let category: keyof AvailableStreams | null = null;
  $('.user-profile__profile-card').filter((_, card) => $(card).find('.user-profile__card-header').text()
    .includes('Watch Twitch'))
    .find('.user-profile__card-body .row')
    .each((_, row) => {
      const heading = $(row).find('.card-table-heading').text();
      if (heading.includes('Hive')) category = 'Hive';
      else if (heading.includes('Nexus')) category = 'Nexus';
      else if (heading) category = null;
      if (!category) return;
      $(row).find('.quest-list__stream-thumbnail a[href]').each((__, link) => {
        const name = $(link).attr('href')?.match(/www\.twitch\.tv\/([^/?]+)/)?.[1];
        if (name && !result[category!].includes(name)) result[category!].push(name);
      });
    });
  return result;
};
