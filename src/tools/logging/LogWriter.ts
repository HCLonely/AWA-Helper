import { promises as fs } from 'fs';
import * as path from 'path';
import { formatLogValue, stripLogAnsi } from './sanitize';
import { getLogFilePath, type LogScope } from './LogContext';

interface PendingLog { filename: string; data: Buffer }

/** One consumer, no hidden stream buffer; the budget includes the active batch. */
export class LogWriter {
  private queue: PendingLog[] = [];
  private bytes = 0;
  private count = 0;
  private timer?: NodeJS.Timeout;
  private running?: Promise<void>;
  private lastDiagnostic = 0;
  private readonly active = new Set<string>();
  readonly stats = { dropped: 0, failed: 0, flushTimeouts: 0, writtenBytes: 0, peakBytes: 0 };

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
    this.queue.push({ filename: path.resolve(filename), data });
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
    // Never re-enter Logger, or print raw filesystem errors containing user data.
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
      // Detach references before awaiting I/O. Retain byte accounting until it completes.
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
          await fs.mkdir(path.dirname(filename), { recursive: true });
          let size = await fs.stat(filename).then((stat) => stat.size, (error: NodeJS.ErrnoException) => {
            if (error.code === 'ENOENT') {
              return 0;
            }
            throw error;
          });
          // Vector writes reuse the queued buffers without a second full-sized concatenation.
          let handle = await fs.open(filename, 'a');
          try {
            let index = 0;
            while (index < buffers.length) {
              if (size + buffers[index].length > this.fileLimit) {
                await handle.close();
                const previous = filename.replace(/\.txt$/, '.1.txt');
                await fs.rm(previous, { force: true });
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
              // writev can complete partially; retry only the unwritten suffix.
              while (vectors.length) {
                const { bytesWritten } = await handle.writev(vectors);
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

/** Internal sink for already-sanitized text; callers must sanitize before this boundary. */
export const writeFormattedFileLog = (scope: LogScope, safeText: string, newLine = true, important = false): void => {
  const text = stripLogAnsi(safeText);
  const encoded = Buffer.from(text.slice(0, 64 * 1024));
  let end = Math.min(encoded.length, (64 * 1024) - (newLine ? 1 : 0));
  // Do not retain an incomplete UTF-8 character at the truncation boundary.
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
