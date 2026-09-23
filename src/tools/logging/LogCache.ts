/**
 * @file src/tools/logging/LogCache.ts
 * @description 维护有容量上限的日志缓存与增量计数。
 */
import type { LogScope } from './LogContext';

export interface WebLogEntry {
  id: number;
  data: unknown;
  type: 'log' | 'questInfo';
  scope: LogScope;
}

/** 以先进先出的方式增量计数，更新已有标识时保留其插入顺序。 */
export class LogCache {
  private readonly sizes = new Map<string, number>();
  private readonly ordinary = new Map<string, LogScope>();
  private readonly scopes = new Map<LogScope, Set<string>>();
  private bytes = 0;

  constructor(private readonly target: Record<string, unknown>, private readonly maxBytes = 512 * 1024, private readonly maxEntries = 1000) {}

  put(entry: WebLogEntry, encoded: string): void {
    const key = `${entry.scope}:${entry.type === 'questInfo' ? 'questInfo' : entry.id}`;
    const size = Buffer.byteLength(encoded);
    this.bytes += size - (this.sizes.get(key) ?? 0);
    this.sizes.set(key, size);
    this.target[key] = entry;
    if (entry.type === 'log') {
      const scope = this.scopes.get(entry.scope) ?? new Set<string>();
      this.scopes.set(entry.scope, scope);
      scope.add(key);
      this.ordinary.set(key, entry.scope);
      while (scope.size > this.maxEntries) {
        this.remove(scope.values().next().value!);
      }
    }
    while (this.bytes > this.maxBytes && this.ordinary.size) {
      this.remove(this.ordinary.keys().next().value!);
    }
  }

  private remove(key: string): void {
    this.bytes -= this.sizes.get(key) ?? 0;
    this.sizes.delete(key);
    const scope = this.ordinary.get(key);
    if (scope) {
      this.scopes.get(scope)?.delete(key);
    }
    this.ordinary.delete(key);
    delete this.target[key];
  }

  get byteLength(): number {
    return this.bytes;
  }
}
