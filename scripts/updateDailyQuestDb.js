const fs = require('fs');
const { execSync } = require('child_process');

const dailyQuestDbChanged = execSync('git status -s').toString().includes('src/dailyQuestDb.json');
if (dailyQuestDbChanged) {
  const dailyQuestDb = JSON.parse(fs.readFileSync('dailyQuestDb.json').toString());
  dailyQuestDb.version = Date.now();
  fs.writeFileSync('dailyQuestDb.json', JSON.stringify(dailyQuestDb, null, 2));
  execSync('git add src/dailyQuestDb.json');
}
