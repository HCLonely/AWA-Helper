/**
 * @file tests/logging-scope.test.js
 * @description 回归验证日志作用域与 WebUI 日志路由。
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const {
  flushLogs, Logger, getLogFilePath, runWithLogScope, safeRequestTarget
} = require('../dist/tools/logging');

test('external request log targets remove query strings and fragments', () => {
  assert.equal(
    safeRequestTarget('https://example.com/path?token=secret&foo=bar#result'),
    'https://example.com/path'
  );
  assert.equal(safeRequestTarget('/relative/path?secret=value'), '/relative/path');
});

test('Logger separates Manager, DailyQuest, Achievement, and Artifact files', async () => {
  const originalDirectory = process.cwd();
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'awa-logs-'));
  process.chdir(directory);
  global.webUI = false;
  global.log = false;
  try {
    new Logger('manager-entry');
    await runWithLogScope('dailyQuest', async () => { await Promise.resolve(); new Logger('daily-entry'); });
    runWithLogScope('achievement', () => new Logger('achievement-entry'));
    runWithLogScope('artifact', () => new Logger('artifact-entry'));
    await flushLogs();
    assert.match(fs.readFileSync(getLogFilePath('manager'), 'utf8'), /manager-entry/);
    assert.match(fs.readFileSync(getLogFilePath('dailyQuest'), 'utf8'), /daily-entry/);
    assert.match(fs.readFileSync(getLogFilePath('achievement'), 'utf8'), /achievement-entry/);
    assert.match(fs.readFileSync(getLogFilePath('artifact'), 'utf8'), /artifact-entry/);
    assert.equal(new Set(['manager', 'dailyQuest', 'achievement', 'artifact'].map(getLogFilePath)).size, 4);
  } finally {
    await flushLogs();
    process.chdir(originalDirectory);
    fs.rmSync(directory, {
      recursive: true,
      force: true
    });
  }
});

test('WebUI buttons request their matching scoped log endpoints', () => {
  const source = fs.readFileSync(path.resolve(__dirname, '../src/webUI/static/js/pages/index.ts'), 'utf8');
  assert.match(source, /openLog\('manager'/);
  assert.match(source, /openLog\('dailyQuest'/);
  assert.match(source, /openLog\('achievement'/);
  const server = fs.readFileSync(path.resolve(__dirname, '../src/server/UnifiedServer.ts'), 'utf8');
  assert.match(server, /getLogFilePath\(candidate\)/);
  assert.match(server, /app\.get\('\/api\/logs\/:job'/);
});

test('Unified server no longer exposes legacy API compatibility routes', () => {
  const server = fs.readFileSync(path.resolve(__dirname, '../src/server/UnifiedServer.ts'), 'utf8');
  [
    '/start', '/stop', '/startAchievement', '/stopAchievement', '/runStatus', '/update',
    '/stopManager', '/runLogs', '/awaAchievementLogs', '/updateCookie', '/updateTwitchCookie',
    '/health/live', '/run-status', '/dailyQuest', '/awa-helper', '/configer'
  ].forEach((route) => assert.ok(!server.includes(`'${route}'`), `legacy route remains on server: ${route}`));
  assert.doesNotMatch(server, /req\.body\?\.secret/);
});

test('Manager WebUI synchronizes Achievement buttons with the running job state', () => {
  const source = fs.readFileSync(path.resolve(__dirname, '../src/webUI/static/js/pages/index.ts'), 'utf8');
  assert.match(source, /axios\.get\('\/api\/jobs\/achievement'/);
  assert.match(source, /\.prop\('disabled', running \|\| stopping\)/);
  assert.match(source, /\.prop\('disabled', !running\)/);
  assert.match(source, /refreshAchievementStatus\(managerServerSecret\)/);
});

test('Manager WebUI uses only the unified API routes', () => {
  const source = fs.readFileSync(path.resolve(__dirname, '../src/webUI/static/js/pages/index.ts'), 'utf8');
  [
    '/api/jobs/dailyQuest',
    '/api/jobs/dailyQuest/start',
    '/api/jobs/dailyQuest/stop',
    '/api/jobs/achievement/start',
    '/api/jobs/achievement/stop',
    '/api/manager/update',
    '/api/manager/shutdown'
  ].forEach((route) => assert.ok(source.includes(route), `missing unified route ${route}`));
  ['/runStatus', '/startAchievement', '/stopAchievement', '/stopManager'].forEach((route) => {
    assert.ok(!source.includes(route), `legacy route remains in WebUI: ${route}`);
  });
  assert.doesNotMatch(source, /axios\.post\('\/(?:start|stop|update)'/);
});

test('log retention recognizes every scoped filename', () => {
  const source = fs.readFileSync(path.resolve(__dirname, '../src/tools/logging/retention.ts'), 'utf8');
  ['Manager-', 'DailyQuest-', 'Achievement-', 'Artifact-'].forEach((prefix) => assert.match(source, new RegExp(prefix)));
});
