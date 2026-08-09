/** Pure parser for AWA avatar inventory and currently equipped items. */
import { load } from 'cheerio';
import type { Id, avatarIds, userAvatarInfo } from '../../../types/achievement';

export interface PersonalizationPage { userId?: string; selection: avatarIds | null }

export const parsePersonalization = (html: string, type: 'avatar' | 'border'): PersonalizationPage => {
  const $ = load(html);
  const userId = html.match(/(?:var|let)\s+user_id\s*=\s*([\d]+);/)?.[1];
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
  return { userId, selection: ids.length && userAvatarInfo[type] ? { ids, userAvatarInfo } : null };
};
