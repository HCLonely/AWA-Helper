import * as fs from 'fs';
import * as path from 'path';

/** Retain the newest completed update for rollback; never remove pending stages. */
export const cleanupCompletedUpdates = (directory = '.update'): number => {
  const root = path.resolve(directory);
  if (!fs.existsSync(root) || fs.lstatSync(root).isSymbolicLink()) {
    return 0;
  }
  const completed: Array<{ target: string, time: number }> = [];
  for (const name of fs.readdirSync(root)) {
    const target = path.resolve(root, name);
    if (!name.startsWith('staging-') || path.dirname(target) !== root) {
      continue;
    }
    try {
      const stat = fs.lstatSync(target);
      const marker = path.join(target, 'completed.json');
      if (stat.isDirectory() && !stat.isSymbolicLink() && !fs.lstatSync(marker).isSymbolicLink() &&
        JSON.parse(fs.readFileSync(marker, 'utf8')).status === 'success') {
        completed.push({ target, time: fs.statSync(marker).mtimeMs });
      }
    } catch (_error) { /* Incomplete or legacy stages need manual inspection. */ }
  }
  completed.sort((a, b) => b.time - a.time);
  let removed = 0;
  for (const { target } of completed.slice(1)) {
    try {
      if (path.dirname(path.resolve(target)) === root && !fs.lstatSync(target).isSymbolicLink()) {
        fs.rmSync(target, { recursive: true, force: true });
        removed++;
      }
    } catch (_error) { /* Retry busy completed stages during the next maintenance pass. */ }
  }
  return removed;
};

export const cleanupCompletedUpdatesAsync = async (directory = '.update'): Promise<number> => {
  const root = path.resolve(directory);
  if (!await fs.promises.lstat(root).then((stat) => !stat.isSymbolicLink(), () => false)) {
    return 0;
  }
  const completed: Array<{ target: string, time: number }> = [];
  for (const name of await fs.promises.readdir(root)) {
    const target = path.resolve(root, name);
    if (!name.startsWith('staging-') || path.dirname(target) !== root) {
      continue;
    }
    try {
      const stat = (await fs.promises.lstat(target));
      const marker = path.join(target, 'completed.json');
      if (stat.isDirectory() && !stat.isSymbolicLink() && !(await fs.promises.lstat(marker)).isSymbolicLink() &&
        JSON.parse(await fs.promises.readFile(marker, 'utf8')).status === 'success') {
        completed.push({ target, time: (await fs.promises.stat(marker)).mtimeMs });
      }
    } catch (_error) { /* Incomplete or legacy stages need manual inspection. */ }
  }
  completed.sort((a, b) => b.time - a.time);
  let removed = 0;
  for (const { target } of completed.slice(1)) {
    try {
      if (path.dirname(path.resolve(target)) === root && !(await fs.promises.lstat(target)).isSymbolicLink()) {
        await fs.promises.rm(target, { recursive: true, force: true });
        removed++;
      }
    } catch (_error) { /* Retry busy completed stages during the next maintenance pass. */ }
  }
  return removed;
};
