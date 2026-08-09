/**
 * @file src/client/AWA/parsers/artifacts.ts
 * @description 解析 AWA 已装备遗物及其 Twitch ARP 加成信息。
 */
import { load } from 'cheerio';

export interface EquippedArtifact { id: number; perkTextShort: string }

/**
 * 解析 parse Equipped Artifacts 相关数据。
 * @param html - 待解析的 HTML 文本，类型为 `string`。
 * @returns `EquippedArtifact[]`，parseEquippedArtifacts 收集或筛选得到的数据列表。
 */
export const parseEquippedArtifacts = (html: string): EquippedArtifact[] => {
  const json = `{${html.match(/artifactsData.*?=.*?{(.+?)};/m)?.[1] || ''}}`;
  try {
    const active = (JSON.parse(json) as { userActiveArtifacts?: Record<string, EquippedArtifact> }).userActiveArtifacts;
    return active ? Object.values(active) : [];
  } catch (_error) {
    return [];
  }
};

/**
 * 解析 parse Twitch Artifact Bonus 相关数据。
 * @param html - 待解析的 HTML 文本，类型为 `string`。
 * @returns `number`，parseTwitchArtifactBonus 计算或读取到的数值。
 */
export const parseTwitchArtifactBonus = (html: string): number => {
  const $ = load(html);
  return $('.artifact-card-chaotic').toArray().reduce((total, card) => {
    if (!$(card).find('button[onClick]').length) {
      return total;
    }
    return total + parseFloat($(card).find('a[data-description-perk]').attr('data-description-perk')
      ?.match(/Twitch quests by ([\d]+)/)?.[1] || '0');
  }, 0);
};
