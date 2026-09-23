/**
 * @file src/tools/logging/LogPage.ts
 * @description 通过文件游标按固定大小读取日志分页。
 */
import { promises as fs } from 'fs';

export interface LogPage {
  text: string;
  older?: string;
  reset: boolean;
  missing: boolean;
}

/** 游标仅包含文件标识和字节偏移，不包含文件系统路径。 */
export const readLogPage = async (filename: string, cursor?: string): Promise<LogPage> => {
  let requested: {
    identity: string;
    end: number
  } | undefined;
  if (cursor) {
    if (cursor.length > 512) {
      throw new Error('Invalid log cursor');
    }
    try {
      requested = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
      if (!requested || typeof requested.identity !== 'string' || !Number.isSafeInteger(requested.end) || requested.end < 0) {
        throw new Error();
      }
    } catch (_error) {
      throw new Error('Invalid log cursor', {
        cause: _error
      });
    }
  }
  let handle;
  try {
    handle = await fs.open(filename, 'r');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return {
        text: '',
        missing: true,
        reset: !!cursor
      };
    }
    throw error;
  }
  try {
    const stat = await handle.stat();
    const identity = `${stat.dev}:${stat.ino}:${stat.birthtimeMs}`;
    const reset = !!requested && (requested.identity !== identity || requested.end > stat.size);
    const end = requested && !reset ? requested.end : stat.size;
    let start = Math.max(0, end - (64 * 1024));
    const buffer = Buffer.alloc(end - start);
    let read = 0;
    while (read < buffer.length) {
      const {
        bytesRead
      } = await handle.read(buffer, read, buffer.length - read, start + read);
      if (!bytesRead) {
        break;
      }
      read += bytesRead;
    }
    let skip = 0;
    while (skip < read && (buffer[skip] & 0xc0) === 0x80) {
      skip++;
    }
    if (skip < read) {
      start += skip;
    }
    // 每次响应最多 64 KiB，翻页时替换预览内容，而非追加。
    return {
      text: buffer.subarray(skip, read).toString('utf8'),
      reset,
      missing: false,
      ...(start > 0 && {
        older: Buffer.from(JSON.stringify({
          identity,
          end: start
        })).toString('base64url')
      })
    };
  } finally {
    await handle.close();
  }
};
