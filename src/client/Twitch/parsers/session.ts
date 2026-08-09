/** Pure parser for the public Twitch Client-Id embedded in application scripts. */
import { load } from 'cheerio';

export const parseTwitchClientId = (html: string): string | null => {
  const $ = load(html);
  const script = $('script').filter((_, element) => !!$(element).html()?.includes('clientId')).first()
    .html();
  return script?.match(/clientId="(.+?)"/)?.[1] || null;
};
