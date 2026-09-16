/**
 * @file tests/daily-cookie-persistence.test.js
 * @description 回归验证每日任务最终生成的 Cookie 会被持久化。
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

test('DailyQuest persists the final refreshed AWA cookie during cleanup', () => {
  const source = fs.readFileSync(path.resolve(__dirname, '../src/core/DailyQuest/DailyQuestRunner.ts'), 'utf8');
  const cleanup = source.slice(source.lastIndexOf('} finally {'));

  assert.match(cleanup, /commitCookie\?\.\(runtimeHolder\.current\.newCookie\)/);
});
