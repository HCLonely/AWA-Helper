/**
 * @file src/tools/logging/retention.ts
 * @description 根据保留天数删除过期日志，并容忍暂时被占用的日志文件。
 */
import * as fs from 'fs';
import * as path from 'path';

const logDatePattern = /^(?:Manager-|DailyQuest-|Achievement-|Artifact-)?(\d{4})-(\d{2})-(\d{2})\.txt$/;

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
