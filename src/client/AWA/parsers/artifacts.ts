/** Pure parsers for equipped artifacts and their Twitch ARP bonuses. */
import { load } from 'cheerio';

export interface EquippedArtifact { id: number; perkTextShort: string }

export const parseEquippedArtifacts = (html: string): EquippedArtifact[] => {
  const json = `{${html.match(/artifactsData.*?=.*?{(.+?)};/m)?.[1] || ''}}`;
  try {
    const active = (JSON.parse(json) as { userActiveArtifacts?: Record<string, EquippedArtifact> }).userActiveArtifacts;
    return active ? Object.values(active) : [];
  } catch (_error) {
    return [];
  }
};

export const parseTwitchArtifactBonus = (html: string): number => {
  const $ = load(html);
  return $('.artifact-card-chaotic').toArray().reduce((total, card) => {
    if (!$(card).find('button[onClick]').length) return total;
    return total + parseFloat($(card).find('a[data-description-perk]').attr('data-description-perk')
      ?.match(/Twitch quests by ([\d]+)/)?.[1] || '0');
  }, 0);
};
