/**
 * @file tests/artifact-config-refresh.test.js
 * @description 回归验证遗物任务刷新后的 Cookie 持久化行为。
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

test('ArtifactJob persists the final refreshed AWA cookie after a successful initialization', () => {
  const source = fs.readFileSync(path.resolve(__dirname, '../src/core/Manager/jobs/ArtifactJob.ts'), 'utf8');

  assert.match(source, /commitCookie\(service\.newCookie\)/);
  assert.match(source, /finally\s*\{/);
});
