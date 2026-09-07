/** Regression coverage for persisting the final cookie produced by DailyQuest. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

test('DailyQuest persists the final refreshed AWA cookie during cleanup', () => {
  const source = fs.readFileSync(path.resolve(__dirname, '../src/core/DailyQuest/DailyQuestRunner.ts'), 'utf8');
  const cleanup = source.slice(source.lastIndexOf('} finally {'));

  assert.match(cleanup, /commitCookie\?\.\(runtimeHolder\.current\.newCookie\)/);
});
