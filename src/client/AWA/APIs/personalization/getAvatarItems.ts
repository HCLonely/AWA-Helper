/** Parses available avatar or border items and the currently equipped avatar. */
import { load } from 'cheerio';
import { http } from '../tools-path';
import { AWAContext } from '../../AWAContext';
import type { Id, avatarIds, userAvatarInfo } from '../../../../types/achievement';

export const getAvatarItems = async (context: AWAContext, type: 'avatar' | 'border'): Promise<avatarIds | null> => {
  const options: myAxiosConfig = { url: `${context.baseURL}/account/personalization`, method: 'GET', headers: context.headers };
  if (context.httpsAgent) options.httpsAgent = context.httpsAgent;
  const response = await http(options);
  const $ = load(response.data);
  const userId = String(response.data).match(/(?:var|let)\s+user_id\s*=\s*([\d]+);/)?.[1];
  if (userId) context.userId = userId;
  const ids: Id[] = [];
  $(`.account-personalization__personalization-item.account-personalization__${type}`).each((_, element) => {
    const id = $(element).attr('data-id');
    const name = $(element).find('.account-personalization__name').text();
    if (id && name) ids.push({ id, name });
  });
  const entries = $('div.user-avatar').first().find('img')
    .toArray()
    .flatMap((image) => {
      const item = $(image);
      const source = item.attr('src')?.split('?')[0];
      const id = source ? $(`img[src^="${source}"]`).parents('.account-personalization__personalization-item').attr('data-id') : undefined;
      if (!id) return [];
      if (item.hasClass('user-avatar__background')) return [['background', id]];
      if (item.hasClass('user-avatar__border')) return [['border', id]];
      if (item.hasClass('user-avatar__avatar')) return [['avatar', id]];
      return [];
    });
  const userAvatarInfo = Object.fromEntries(entries) as userAvatarInfo;
  return ids.length && userAvatarInfo[type] ? { ids, userAvatarInfo } : null;
};
