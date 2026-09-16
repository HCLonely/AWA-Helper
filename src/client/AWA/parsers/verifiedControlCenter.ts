import { load, type CheerioAPI } from 'cheerio';
import { PlatformError } from '../../shared/PlatformError';
import { parseControlCenter } from './controlCenter';

export class PageParseError extends PlatformError {
  readonly parser = 'awa/control-center';
  readonly parserVersion = 1;
  constructor(readonly missingFields: string[]) {
    super('awa', 'parseControlCenter', `PAGE_STRUCTURE_CHANGED: awa/control-center v1; missing or invalid: ${missingFields.join(', ')}`);
    this.name = 'PageParseError';
  }
}

/** An empty recognized task list is valid; a login/error/unknown page is not. */
export const parseVerifiedControlCenter = (html: string, baseURL: string, $: CheerioAPI = load(html)) => {
  if ($('a.nav-link-login, form[action*="/login"]').length) {
    throw new PlatformError('awa', 'parseControlCenter', 'AWA cookie has expired', false, 602);
  }
  if (/we have detected an issue with your network/i.test(html)) {
    throw new PlatformError('awa', 'parseControlCenter', 'AWA rejected the current network address', false, 610);
  }
  const missing: string[] = [];
  if (!$('div.user-profile__card-body').length) {
    missing.push('user-profile__card-body');
  }
  const raw = html.match(/dailyArpData\s*=\s*({.+?}})/)?.[1];
  try {
    const data = JSON.parse(raw || 'null');
    for (const [name, value] of Object.entries({
      timeOnSiteCap: data?.timeOnSiteCap, timeOnSiteArp: data?.timeOnSiteArp, dailyArp: data?.dailyArp,
      'twitchData.totalPoints': data?.twitchData?.totalPoints, 'twitchData.bonusPoints': data?.twitchData?.bonusPoints
    })) {
      if ((typeof value !== 'number' && typeof value !== 'string') || String(value).trim() === '' || !Number.isFinite(Number(value)) || Number(value) < 0) {
        missing.push(`dailyArpData.${name}`);
      }
    }
  } catch (_error) {
    missing.push('dailyArpData');
  }
  if (missing.length) {
    throw new PageParseError(missing);
  }
  return parseControlCenter(html, baseURL, $);
};
