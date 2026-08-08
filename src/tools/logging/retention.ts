/**
 * @file retention
 * @description Removes log files older than the configured retention period.
 */
import * as fs from 'fs';
import * as path from 'path';

const logDatePattern = /^(?:Manager-|Achievement-|Archievement-)?(\d{4})-(\d{2})-(\d{2})\.txt$/;

const cleanupExpiredLogs = (directory: string, expireDays: number, now = new Date()): number => {
  if (!Number.isFinite(expireDays) || expireDays <= 0 || !fs.existsSync(directory)) return 0;
  const todayUtc = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  let removed = 0;
  for (const filename of fs.readdirSync(directory)) {
    const match = filename.match(logDatePattern);
    if (!match) continue;
    const [, year, month, day] = match;
    const logDateUtc = Date.UTC(Number(year), Number(month) - 1, Number(day));
    const parsedDate = new Date(logDateUtc);
    if (parsedDate.getUTCFullYear() !== Number(year) || parsedDate.getUTCMonth() !== Number(month) - 1 || parsedDate.getUTCDate() !== Number(day)) continue;
    if ((todayUtc - logDateUtc) / 86_400_000 < expireDays) continue;
    try {
      fs.unlinkSync(path.join(directory, filename));
      removed++;
    } catch (_error) {
      // A locked log can be retried during the next startup.
    }
  }
  return removed;
};

export { cleanupExpiredLogs };
