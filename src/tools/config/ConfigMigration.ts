/**
 * @file ConfigMigration
 * @description Normalizes legacy managerServer, corn, and string Artifact fields without retaining a second port.
 */
import * as fs from 'fs';
import { join } from 'path';
import type { NormalizedManagerConfig } from './types';

const normalizeManagerConfig = (value: config): Omit<NormalizedManagerConfig, 'secret'> => {
  const legacy = value.managerServer;
  const current = value.manager;
  const configuredArtifacts = current?.artifacts || legacy?.artifacts || [];
  const artifacts = configuredArtifacts.flatMap((item) => {
    const cron = item.cron || ('corn' in item ? item.corn : undefined);
    if (!cron) return [];
    const rawIds: string | number[] = item.ids;
    return [{
      cron,
      ids: typeof rawIds === 'string'
        ? rawIds.split(',').map((id) => Number.parseInt(id.trim(), 10)).filter(Number.isFinite)
        : rawIds
    }];
  });
  return {
    dailyQuestCron: current?.dailyQuest?.cron || legacy?.cron || legacy?.corn,
    achievement: {
      enable: current?.achievement?.enable ?? (
        fs.existsSync(join('data', 'achievement', 'enabled')) || fs.existsSync(join('data', 'Archievement'))
      ),
      cron: current?.achievement?.cron || '0 14 * * *'
    },
    artifacts
  };
};

export { normalizeManagerConfig };
