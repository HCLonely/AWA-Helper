const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('AchievementJob reloads and persists the AWA cookie for every run', () => {
  const source = fs.readFileSync(path.join(__dirname, '../src/core/Manager/jobs/AchievementJob.ts'), 'utf8');
  assert.match(source, /const appConfig = loadConfig\(this\.configPath\)\.raw/);
  assert.match(source, /commitCookie\(this\.service\.awa\.newCookie\)/);
  assert.match(source, /finally\s*\{[\s\S]*commitCookie/);
});

test('Manager gives AchievementJob the live configuration path instead of a startup snapshot', () => {
  const source = fs.readFileSync(path.join(__dirname, '../src/core/Manager/ManagerRuntime.ts'), 'utf8');
  assert.match(source, /new AchievementJob\(this\.loaded\.path\)/);
  assert.doesNotMatch(source, /new AchievementJob\(this\.loaded\.raw\)/);
});

test('Achievement forwards its proxy configuration to both AWA and Twitch clients', () => {
  const source = fs.readFileSync(path.join(__dirname, '../src/core/Achievement/AchievementService.ts'), 'utf8');
  assert.match(source, /this\.proxy = proxy/);
  assert.match(source, /new AWAApiClient\(\{[\s\S]*?proxy,/);
  assert.match(source, /new TwitchClient\(\{[\s\S]*?proxy: this\.proxy,/);
});
