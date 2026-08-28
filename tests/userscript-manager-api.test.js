/** Regression coverage for the userscript's Manager API integration. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const source = fs.readFileSync(path.resolve(__dirname, '../TM_UserScript/AWA-Manager.user.js'), 'utf8');

test('AWA Manager userscript uses the unified API with Bearer authentication', () => {
  [
    '/api/cookies/awa',
    '/api/cookies/twitch',
    '/api/jobs/dailyQuest',
    '/api/jobs/dailyQuest/start',
    '/api/jobs/dailyQuest/stop'
  ].forEach((route) => assert.ok(source.includes(route), `missing unified route ${route}`));

  assert.match(source, /Authorization: `Bearer \$\{secret\}`/);
  assert.doesNotMatch(source, /data:\s*\{\s*secret(?:,|\s*\})/);
});

test('AWA Manager userscript no longer references legacy Manager routes', () => {
  ['/runStatus', '/start', '/stop', '/updateCookie', '/updateTwitchCookie'].forEach((route) => {
    assert.ok(!source.includes(`'${route}'`) && !source.includes(`\`${route}\``), `legacy route remains: ${route}`);
  });
});
