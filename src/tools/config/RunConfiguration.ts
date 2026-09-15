import { AsyncLocalStorage } from 'async_hooks';
import { createHash } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { loadConfig, locateConfig } from './ConfigLoader';
import type { LoadedConfig } from './types';
import { withLogSecrets } from '../logging/sanitize';
import { createCookieCommit } from './YamlConfig';

const runs = new AsyncLocalStorage<LoadedConfig>();
const snapshots = new Map<string, { digest: string; loaded: LoadedConfig }>();

/** Hash the file to detect even same-size replacements; parse only changed configurations. */
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
    snapshot = { digest, loaded };
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

/** One persistence boundary for all jobs; preserves the existing compare-and-swap contract. */
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
