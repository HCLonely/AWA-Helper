/**
 * @file src/tools/config/ConfigMigration.ts
 * @description 将旧版 Manager、Cron 和遗物字段迁移为当前配置结构。
 */
import * as fs from 'fs';
import { join } from 'path';
import type { NormalizedManagerConfig } from './types';

/**
 * 更新 normalize Manager Config 相关数据。
 * @param value - 需要写入或参与计算的值，类型为 `config`。
 * @returns `Omit<NormalizedManagerConfig, "secret">`，迁移旧字段并规范化后的 Manager 配置（不含密钥）。
 */
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
