/**
 * @file src/tools/logging/LogWriter.ts
 * @description 以有容量上限的队列异步批量写入日志。
 */
import { promises as fs } from 'fs';
import * as path from 'path';
import { formatLogValue, stripLogAnsi } from './sanitize';
import { getLogFilePath, type LogScope } from './LogContext';

interface PendingLog {
  filename: string;
  data: Buffer
}

/** 仅使用一个消费者且无隐藏流缓冲，容量预算包含正在写入的批次。 */
export class LogWriter {
  private queue: PendingLog[] = [];
  private bytes = 0;
  private count = 0;
  private timer?: NodeJS.Timeout;
  private running?: Promise<void>;
  private lastDiagnostic = 0;
  private readonly active = new Set<string>();
  readonly stats = {
    dropped: 0,
    failed: 0,
    flushTimeouts: 0,
    writtenBytes: 0,
    peakBytes: 0
  };

  constructor(private readonly limit = 1024 * 1024, private readonly fileLimit = 10 * 1024 * 1024) {}

  enqueue(filename: string, data: Buffer, important = false): boolean {
    if (!data.length) {
      return true;
    }
    const reserve = important ? 0 : Math.min(64 * 1024, Math.floor(this.limit / 16));
    if (this.count >= (important ? 4096 : 4064) || this.bytes + data.length > this.limit - reserve || data.length > this.fileLimit) {
      this.stats.dropped++;
      this.diagnose();
      return false;
    }
    this.queue.push({
      filename: path.resolve(filename),
      data
    });
    this.bytes += data.length;
    this.count++;
    this.stats.peakBytes = Math.max(this.stats.peakBytes, this.bytes);
    if (this.bytes >= 64 * 1024) {
      this.start();
    } else if (!this.timer && !this.running) {
      this.timer = setTimeout(() => this.start(), 100);
    }
    return true;
  }

  get pendingBytes(): number {
    return this.bytes;
  }
  isActive(filename: string): boolean {
    const absolute = path.resolve(filename);
    return this.active.has(absolute) || this.queue.some((entry) => entry.filename === absolute);
  }

  private diagnose(): void {
    if (Date.now() - this.lastDiagnostic < 10000) {
      return;
    }
    this.lastDiagnostic = Date.now();
    // 避免再次调用 Logger，也不输出可能包含用户数据的原始文件系统错误。
    process.stderr.write(`[log-writer] dropped=${this.stats.dropped} failed=${this.stats.failed} flushTimeouts=${this.stats.flushTimeouts} pendingBytes=${this.bytes}\n`);
  }

  private start(): void {
    clearTimeout(this.timer);
    this.timer = undefined;
    if (this.running || !this.queue.length) {
      return;
    }
    this.running = this.drain().finally(() => {
      this.running = undefined;
      if (this.queue.length) {
        this.start();
      }
    });
  }

  private async drain(): Promise<void> {
    while (this.queue.length) {
      // 等待输入输出前解除引用，但保留字节计数直到操作完成。
      const batch = this.queue;
      this.queue = [];
      for (const entry of batch) {
        this.active.add(entry.filename);
      }
      const files = new Map<string, Buffer[]>();
      for (const entry of batch) {
        const buffers = files.get(entry.filename) ?? [];
        buffers.push(entry.data);
        files.set(entry.filename, buffers);
      }
      for (const [filename, buffers] of files) {
        try {
          await fs.mkdir(path.dirname(filename), {
            recursive: true
          });
          let size = await fs.stat(filename).then((stat) => stat.size, (error: NodeJS.ErrnoException) => {
            if (error.code === 'ENOENT') {
              return 0;
            }
            throw error;
          });
          // 向量写入复用队列中的缓冲区，避免再次拼接同等大小的数据。
          let handle = await fs.open(filename, 'a');
          try {
            let index = 0;
            while (index < buffers.length) {
              if (size + buffers[index].length > this.fileLimit) {
                await handle.close();
                const previous = filename.replace(/\.txt$/, '.1.txt');
                await fs.rm(previous, {
                  force: true
                });
                await fs.rename(filename, previous);
                handle = await fs.open(filename, 'a');
                size = 0;
              }
              const vectors: Buffer[] = [];
              let length = 0;
              while (index < buffers.length && (vectors.length === 0 ||
                (length + buffers[index].length <= 64 * 1024 && size + length + buffers[index].length <= this.fileLimit))) {
                length += buffers[index].length;
                vectors.push(buffers[index++]);
              }
              // writev 可能仅完成部分写入，只重试尚未写入的后缀。
              while (vectors.length) {
                const {
                  bytesWritten
                } = await handle.writev(vectors);
                if (!bytesWritten) {
                  throw new Error('Log write made no progress');
                }
                size += bytesWritten;
                this.stats.writtenBytes += bytesWritten;
                let remaining = bytesWritten;
                while (vectors.length && remaining >= vectors[0].length) {
                  remaining -= vectors.shift()!.length;
                }
                if (remaining) {
                  vectors[0] = vectors[0].subarray(remaining);
                }
              }
            }
          } finally {
            await handle.close();
          }
        } catch (_error) {
          this.stats.failed += buffers.length;
          this.diagnose();
        } finally {
          this.active.delete(filename);
        }
      }
      this.count -= batch.length;
      this.bytes -= batch.reduce((sum, entry) => sum + entry.data.length, 0);
    }
  }

  async flush(timeoutMs = 5000): Promise<boolean> {
    this.start();
    if (!this.running) {
      return true;
    }
    let timer: NodeJS.Timeout | undefined;
    try {
      return await Promise.race([
        this.running.then(() => this.bytes === 0),
        new Promise<boolean>((resolve) => {
          timer = setTimeout(() => {
            this.stats.flushTimeouts++;
            this.diagnose();
            resolve(false);
          }, timeoutMs);
        })
      ]);
    } finally {
      clearTimeout(timer);
    }
  }
}

export const logWriter = new LogWriter();
export const flushLogs = (timeoutMs = 5000): Promise<boolean> => logWriter.flush(timeoutMs);

/** 仅接收已脱敏文本的内部写入入口，调用方必须事先脱敏。 */
export const writeFormattedFileLog = (scope: LogScope, safeText: string, newLine = true, important = false): void => {
  const text = stripLogAnsi(safeText);
  const encoded = Buffer.from(text.slice(0, 64 * 1024));
  let end = Math.min(encoded.length, (64 * 1024) - (newLine ? 1 : 0));
  // 截断边界不保留不完整的 UTF-8 字符。
  if (end < encoded.length) {
    while (end > 0 && (encoded[end] & 0xc0) === 0x80) {
      end--;
    }
  }
  const data = Buffer.allocUnsafe(end + (newLine ? 1 : 0));
  encoded.copy(data, 0, 0, end);
  if (newLine) {
    data[end] = 10;
  }
  logWriter.enqueue(getLogFilePath(scope), data, important);
};

export const writeFileLog = (scope: LogScope, value: unknown, newLine = true): void => {
  writeFormattedFileLog(scope, formatLogValue(value), newLine, value instanceof Error);
};
