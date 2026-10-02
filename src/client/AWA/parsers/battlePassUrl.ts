/**
 * @file src/client/AWA/parsers/battlePassUrl.ts
 * @description 从页面公共导航中识别 Battle Pass 入口。
 */
import type { CheerioAPI } from 'cheerio';

/** 统一解析控制中心和个性化页面中的 Battle Pass 导航地址。 */
export const parseBattlePassUrl = ($: CheerioAPI, baseURL: string): string | undefined => {
  const href = $('a.um-nav-link[href*="/control-center/battle-pass/"]').first().attr('href');
  return href ? new URL(href, `${baseURL}/`).href : undefined;
};
