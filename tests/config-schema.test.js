const assert = require('node:assert/strict');
const test = require('node:test');
const { deepMerge, validateHelperConfig } = require('../dist/core/config/configSchema');
const { Cookie } = require('../dist/tool');
const { getManagerListenHost } = require('../dist/manager/network');

test('deepMerge preserves nested defaults', () => {
  const merged = deepMerge({ webUI: { enable: true, port: 3456, local: true } }, { webUI: { port: 8080 } });
  assert.deepEqual(merged, { webUI: { enable: true, port: 8080, local: true } });
});

test('validateHelperConfig reports invalid ports and arrays', () => {
  const errors = validateHelperConfig({
    language: 'zh',
    awaHost: 'www.alienwarearena.com',
    awaQuests: 'dailyQuest',
    awaDailyQuestType: [],
    webUI: { port: 70000 }
  });
  assert.equal(errors.includes('awaQuests must be an array of strings'), true);
  assert.equal(errors.includes('webUI.port must be an integer between 1 and 65535'), true);
});

test('Cookie preserves equals signs in values', () => {
  const cookie = new Cookie('token=header.payload=signature; empty=; name=value');
  assert.equal(cookie.get('token'), 'header.payload=signature');
  assert.equal(cookie.get('empty'), '');
  assert.equal(cookie.get('name'), 'value');
});

test('Manager local binding remains reachable through container port forwarding', () => {
  assert.equal(getManagerListenHost(true, false), '127.0.0.1');
  assert.equal(getManagerListenHost(true, true), '0.0.0.0');
  assert.equal(getManagerListenHost(false, false), '0.0.0.0');
});
