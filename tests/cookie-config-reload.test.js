/** Regression coverage for synchronizing persisted credentials with Manager state. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const source = fs.readFileSync(path.resolve(__dirname, '../src/server/UnifiedServer.ts'), 'utf8');

test('cookie API writes credentials to disk and reloads the live configuration', () => {
  const awaRoute = source.slice(source.indexOf("app.post('/api/cookies/awa'"), source.indexOf("app.post('/api/cookies/twitch'"));
  const twitchRoute = source.slice(source.indexOf("app.post('/api/cookies/twitch'"), source.indexOf('/**', source.indexOf("app.post('/api/cookies/twitch'")));

  assert.match(awaRoute, /updateYamlFieldsSync\(configPath, \{ awaCookie:/);
  assert.match(awaRoute, /this\.reloadConfig\(\)/);
  assert.match(twitchRoute, /updateYamlFieldsSync\(configPath, \{ twitchCookie:/);
  assert.match(twitchRoute, /this\.reloadConfig\(\)/);
});
