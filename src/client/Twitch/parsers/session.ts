/**
 * @file src/client/Twitch/parsers/session.ts
 * @description 从 Twitch 公共页面脚本中提取请求所需的 Client-ID。
 */
import { load } from 'cheerio';

/**
 * 解析 Twitch 客户端标识。
 * @param html - 待解析的 HTML 文本，类型为 `string`。
 * @returns `string | null`，parseTwitchClientId 解析得到的结构化结果。
 */
export const parseTwitchClientId = (html: string): string | null => {
  const $ = load(html);
  const script = $('script').filter((_, element) => !!$(element).html()?.includes('clientId')).first()
    .html();
  return script?.match(/clientId="(.+?)"/)?.[1] || null;
};
