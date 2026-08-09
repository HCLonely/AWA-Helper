/** Scoped logging and WebUI log-route regression tests. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { Logger, getLogFilePath, runWithLogScope } = require('../dist/tools/logging');

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
    assert.match(fs.readFileSync(getLogFilePath('manager'), 'utf8'), /manager-entry/);
    assert.match(fs.readFileSync(getLogFilePath('dailyQuest'), 'utf8'), /daily-entry/);
    assert.match(fs.readFileSync(getLogFilePath('achievement'), 'utf8'), /achievement-entry/);
    assert.match(fs.readFileSync(getLogFilePath('artifact'), 'utf8'), /artifact-entry/);
    assert.equal(new Set(['manager', 'dailyQuest', 'achievement', 'artifact'].map(getLogFilePath)).size, 4);
  } finally {
    process.chdir(originalDirectory);
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('WebUI buttons request their matching scoped log endpoints', () => {
  const source = fs.readFileSync(path.resolve(__dirname, '../src/webUI/static/js/pages/index.js'), 'utf8');
  assert.match(source, /openLog\('manager'/);
  assert.match(source, /openLog\('dailyQuest'/);
  assert.match(source, /openLog\('achievement'/);
  const server = fs.readFileSync(path.resolve(__dirname, '../src/server/UnifiedServer.ts'), 'utf8');
  assert.match(server, /getLogFilePath\(candidate\)/);
  assert.match(server, /sendLogs\(req, res, 'dailyQuest'\)/);
  assert.match(server, /sendLogs\(req, res, 'achievement'\)/);
});

test('log retention recognizes every scoped filename', () => {
  const source = fs.readFileSync(path.resolve(__dirname, '../src/tools/logging/retention.ts'), 'utf8');
  ['Manager-', 'DailyQuest-', 'Achievement-', 'Artifact-'].forEach((prefix) => assert.match(source, new RegExp(prefix)));
});
