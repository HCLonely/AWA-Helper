/**
 * @file src/tools/process/ProcessLock.ts
 * @description 使用原子锁文件阻止重复进程，并安全恢复过期或异常锁。
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

  /**
   * 初始化 Process Lock 实例。
   * @param lockPath - 待读取或写入文件的路径，类型为 `string`。
   */
  constructor(lockPath: string) {
    this.lockPath = lockPath;
  }

  /**
   * 获取 acquire 相关数据。
   * @returns `Promise<boolean>`，表示 acquire 检查是否通过。
   */
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

  /**
   * 停止 release 相关数据。
   * @returns `Promise<void>`，异步操作完成后兑现，不携带结果值。
   */
  async release(): Promise<void> {
    if (!this.acquired) {
      return;
    }
    this.acquired = false;
    await this.handle?.close().catch(() => undefined);
    this.handle = undefined;
    await fs.promises.rm(this.lockPath, { force: true }).catch(() => undefined);
  }

  /**
   * 停止 release Sync 相关数据。
   * @returns `void`，该函数仅执行副作用，不返回值。
   */
  releaseSync(): void {
    if (!this.acquired) {
      return;
    }
    this.acquired = false;
    try {
      fs.rmSync(this.lockPath, { force: true });
    } catch (_error) {
      // 过期锁将在下次启动时恢复。
    }
  }

  /**
   * 删除 remove Stale Lock 相关数据。
   * @returns `Promise<boolean>`，表示 removeStaleLock 检查是否通过。
   */
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
      // 第二个进程可能在独占创建文件后、写入元数据前读取该文件。
      // 仅恢复已存在足够长时间的异常锁文件。
      const stats = await fs.promises.stat(this.lockPath).catch(() => undefined);
      if (stats && Date.now() - stats.mtimeMs < ProcessLock.malformedLockGraceMs) {
        return false;
      }
      await fs.promises.rm(this.lockPath, { force: true });
      return true;
    }
  }

  /**
   * 检查 is Process Running 相关数据。
   * @param pid - 需要检查是否仍在运行的进程标识，类型为 `number`。
   * @returns `boolean`，表示 isProcessRunning 检查是否通过。
   */
  private isProcessRunning(pid: number): boolean {
    if (!Number.isSafeInteger(pid) || pid <= 0) {
      return false;
    }
    try {
      process.kill(pid, 0);
      return true;
    } catch (error) {
      return (error as ErrorWithCode).code === 'EPERM';
    }
  }
}

export { ProcessLock };
