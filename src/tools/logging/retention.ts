/**
 * @file src/tools/logging/retention.ts
 * @description 根据保留天数删除过期日志，并容忍暂时被占用的日志文件。
 */
import * as fs from 'fs';
import * as path from 'path';

const logDatePattern = /^(?:Manager-|DailyQuest-|Achievement-|Artifact-)?(\d{4})-(\d{2})-(\d{2})(?:\.1)?\.txt$/;

/**
 * 删除 cleanup Expired Logs 相关数据。
 * @param directory - 需要扫描和清理日志文件的目录，类型为 `string`。
 * @param expireDays - 日志文件允许保留的天数，类型为 `number`。
 * @param now - 计算或比较时使用的时间，类型为 `Date`。
 * @returns `number`，cleanupExpiredLogs 计算或读取到的数值。
 */
const cleanupExpiredLogs = (directory: string, expireDays: number, now = new Date()): number => {
  if (!Number.isFinite(expireDays) || expireDays <= 0 || !fs.existsSync(directory)) {
    return 0;
  }
  const todayUtc = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  let removed = 0;
  for (const filename of fs.readdirSync(directory)) {
    const match = filename.match(logDatePattern);
    if (!match) {
      continue;
    }
    const [, year, month, day] = match;
    const logDateUtc = Date.UTC(Number(year), Number(month) - 1, Number(day));
    const parsedDate = new Date(logDateUtc);
    if (parsedDate.getUTCFullYear() !== Number(year) || parsedDate.getUTCMonth() !== Number(month) - 1 || parsedDate.getUTCDate() !== Number(day)) {
      continue;
    }
    if ((todayUtc - logDateUtc) / 86_400_000 < expireDays) {
      continue;
    }
    try {
      fs.unlinkSync(path.join(directory, filename));
      removed++;
    } catch (_error) {
      // 被占用的日志文件可在下次启动时重新清理。
    }
  }
  return removed;
};

export { cleanupExpiredLogs };

/** Bounded asynchronous maintenance; never follows links or removes active files. */
export const maintainLogs = async (
  directory: string, expireDays: number, maxBytes: number,
  isActive: (filename: string) => boolean = () => false, now = new Date()
): Promise<{ removed: number; remainingBytes: number }> => {
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const candidates: Array<{ filename: string; bytes: number; date: number; removable: boolean }> = [];
  let total = 0;
  let removed = 0;
  const root = path.resolve(directory);
  try {
    if ((await fs.promises.lstat(root)).isSymbolicLink()) {
      return { removed, remainingBytes: total };
    }
    const entries = await fs.promises.readdir(root, { withFileTypes: true });
    for (const entry of entries) {
      const match = entry.name.match(logDatePattern);
      if (!match || !entry.isFile() || entry.isSymbolicLink()) {
        continue;
      }
      const date = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
      const parsed = new Date(date);
      if (parsed.getUTCFullYear() !== Number(match[1]) || parsed.getUTCMonth() !== Number(match[2]) - 1 || parsed.getUTCDate() !== Number(match[3])) {
        continue;
      }
      const filename = path.join(root, entry.name);
      try {
        const stat = await fs.promises.lstat(filename);
        if (!stat.isFile() || stat.isSymbolicLink()) {
          continue;
        }
        total += stat.size;
        candidates.push({ filename, bytes: stat.size, date, removable: date < today });
      } catch (_error) { /* Rotation may remove an entry while scanning. */ }
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error;
    }
  }
  candidates.sort((a, b) => a.date - b.date);
  for (const candidate of candidates) {
    const expired = expireDays > 0 && (today - candidate.date) / 86400000 >= expireDays;
    if (!candidate.removable || isActive(candidate.filename) || !(expired || (maxBytes > 0 && total > maxBytes))) {
      continue;
    }
    try {
      if (!(await fs.promises.lstat(candidate.filename)).isFile()) {
        continue;
      }
      await fs.promises.unlink(candidate.filename);
      total -= candidate.bytes;
      removed++;
    } catch (_error) { /* Busy files are retried on the next maintenance pass. */ }
  }
  return { removed, remainingBytes: total };
};
