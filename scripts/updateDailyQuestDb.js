/**
 * @file scripts/updateDailyQuestDb.js
 * @description 更新每日任务数据库。
 */
const fs = require('fs');
const {
  execSync
} = require('child_process');

const dailyQuestDbPath = 'src/data/dailyQuestDb.json';
const dailyQuestDbChanged = execSync(`git status --short -- ${dailyQuestDbPath}`).toString().trim().length > 0;
if (dailyQuestDbChanged) {
  const dailyQuestDb = JSON.parse(fs.readFileSync(dailyQuestDbPath).toString());
  dailyQuestDb.version = Date.now();
  fs.writeFileSync(dailyQuestDbPath, JSON.stringify(dailyQuestDb, null, 2));
  execSync(`git add ${dailyQuestDbPath}`);
}
