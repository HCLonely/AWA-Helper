/**
 * @file ProcessLock
 * @description Provides an atomic, stale-lock-aware process lock for Manager runtimes.
 */
import * as fs from 'fs';
import * as path from 'path';

interface LockData {
  pid: number
  startedAt: string
}

type ErrorWithCode = Error & { code?: string };

class ProcessLock {
  private static readonly malformedLockGraceMs = 30_000;
  private handle?: fs.promises.FileHandle;
  private acquired = false;
  private readonly lockPath: string;

  constructor(lockPath: string) {
    this.lockPath = lockPath;
  }

  async acquire(): Promise<boolean> {
    await fs.promises.mkdir(path.dirname(this.lockPath), { recursive: true });

    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        this.handle = await fs.promises.open(this.lockPath, 'wx', 0o600);
        const lockData: LockData = {
          pid: process.pid,
          startedAt: new Date().toISOString()
        };
        await this.handle.writeFile(JSON.stringify(lockData));
        await this.handle.close();
        this.handle = undefined;
        this.acquired = true;
        return true;
      } catch (error) {
        if ((error as ErrorWithCode).code !== 'EEXIST') {
          throw error;
        }

        if (attempt === 0 && await this.removeStaleLock()) {
          continue;
        }
        return false;
      }
    }
    return false;
  }

  async release(): Promise<void> {
    if (!this.acquired) return;
    this.acquired = false;
    await this.handle?.close().catch(() => undefined);
    this.handle = undefined;
    await fs.promises.rm(this.lockPath, { force: true }).catch(() => undefined);
  }

  releaseSync(): void {
    if (!this.acquired) return;
    this.acquired = false;
    try {
      fs.rmSync(this.lockPath, { force: true });
    } catch (_error) {
      // A stale lock is recovered on the next startup.
    }
  }

  private async removeStaleLock(): Promise<boolean> {
    try {
      const lockData = JSON.parse(await fs.promises.readFile(this.lockPath, 'utf8')) as Partial<LockData>;
      if (typeof lockData.pid === 'number' && this.isProcessRunning(lockData.pid)) {
        return false;
      }
      await fs.promises.rm(this.lockPath, { force: true });
      return true;
    } catch (error) {
      if ((error as ErrorWithCode).code === 'ENOENT') {
        return true;
      }
      // A second process can observe the file between the exclusive create and
      // the metadata write. Only recover malformed locks that are old enough.
      const stats = await fs.promises.stat(this.lockPath).catch(() => undefined);
      if (stats && Date.now() - stats.mtimeMs < ProcessLock.malformedLockGraceMs) {
        return false;
      }
      await fs.promises.rm(this.lockPath, { force: true });
      return true;
    }
  }

  private isProcessRunning(pid: number): boolean {
    if (!Number.isSafeInteger(pid) || pid <= 0) return false;
    try {
      process.kill(pid, 0);
      return true;
    } catch (error) {
      return (error as ErrorWithCode).code === 'EPERM';
    }
  }
}

export { ProcessLock };
