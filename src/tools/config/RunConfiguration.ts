/**
 * @file src/tools/config/RunConfiguration.ts
 * @description 检测配置变更，并统一持久化作业刷新后的配置。
 */
import { AsyncLocalStorage } from 'async_hooks';
import { createHash } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { loadConfig, locateConfig } from './ConfigLoader';
import type { LoadedConfig } from './types';
import { withLogSecrets } from '../logging/sanitize';
import { createCookieCommit } from './YamlConfig';

const runs = new AsyncLocalStorage<LoadedConfig>();
const snapshots = new Map<string, {
  digest: string;
  loaded: LoadedConfig
}>();

/** 通过文件哈希检测同大小的替换，仅解析发生变化的配置。 */
export const getRunConfiguration = (filename?: string): LoadedConfig => {
  const active = runs.getStore();
  if (active && (!filename || path.resolve(filename) === active.path)) {
    return active;
  }
  const target = path.resolve(filename || locateConfig());
  const digest = createHash('sha256').update(fs.readFileSync(target)).digest('hex');
  let snapshot = snapshots.get(target);
  if (!snapshot || snapshot.digest !== digest) {
    const loaded = loadConfig(target);
    snapshot = {
      digest,
      loaded
    };
    snapshots.delete(target);
    snapshots.set(target, snapshot);
    while (snapshots.size > 4) {
      snapshots.delete(snapshots.keys().next().value!);
    }
  }
  return structuredClone(snapshot.loaded);
};

export const withRunConfiguration = async <T>(filename: string | undefined, action: () => Promise<T>): Promise<T> => {
  const loaded = getRunConfiguration(filename);
  return runs.run(loaded, () => withLogSecrets(loaded.raw, action));
};

/** 所有作业共用一个持久化入口，保留现有的比较后交换契约。 */
export const createSessionCommit = (filename: string, initialCookie: string): ((cookie: string) => boolean) => {
  const commit = createCookieCommit(filename, initialCookie);
  return (cookie) => {
    const saved = commit(cookie);
    if (saved) {
      snapshots.delete(path.resolve(filename));
    }
    return saved;
  };
};

export const hasRunConfiguration = (): boolean => !!runs.getStore();
