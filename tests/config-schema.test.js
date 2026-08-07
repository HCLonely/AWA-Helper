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
    webUI: { enable: true, port: 70000 }
  });
  assert.equal(errors.includes('awaQuests must be an array of strings'), true);
  assert.equal(errors.includes('webUI.port must be an integer between 1 and 65535'), true);
});

test('validateHelperConfig rejects malformed nested and security-sensitive fields', () => {
  const defaults = {
    language: 'zh',
    awaHost: 'www.alienwarearena.com',
    awaQuests: [],
    awaDailyQuestType: [],
    webUI: { enable: true, port: 3456 },
    managerServer: { enable: false, secret: '', port: 2345 }
  };
  assert.equal(validateHelperConfig(deepMerge(defaults, { webUI: null })).includes('webUI must be an object'), true);
  assert.equal(validateHelperConfig(deepMerge(defaults, { managerServer: { enable: true, secret: 'short' } })).includes('managerServer.secret must contain at least 16 characters when enabled'), true);
  assert.equal(validateHelperConfig(deepMerge(defaults, { proxy: { enable: ['awa'], protocol: 'http', host: '', port: 99999 } })).includes('proxy.port must be an integer between 1 and 65535'), true);
  assert.equal(validateHelperConfig(deepMerge(defaults, { TLSRejectUnauthorized: 'false' })).includes('TLSRejectUnauthorized must be a boolean'), true);
});

test('disabled features allow empty child settings', () => {
  const config = {
    language: 'zh',
    awaHost: 'www.alienwarearena.com',
    awaQuests: ['dailyQuest'],
    awaDailyQuestType: [],
    webUI: { enable: false, port: '', local: '' },
    managerServer: { enable: false, secret: '', port: '', local: '', corn: null, artifacts: null },
    proxy: { enable: [], protocol: '', host: '', port: '' },
    asfProtocol: '',
    asfPort: ''
  };
  assert.deepEqual(validateHelperConfig(config), []);
});

test('enabled features require valid child settings', () => {
  const config = {
    language: 'zh',
    awaHost: 'www.alienwarearena.com',
    awaQuests: ['steamQuest'],
    awaDailyQuestType: [],
    webUI: { enable: true, port: '' },
    managerServer: { enable: true, secret: '', port: '' },
    proxy: { enable: ['awa'], protocol: '', host: '', port: '' },
    asfProtocol: '',
    asfPort: ''
  };
  const errors = validateHelperConfig(config);
  assert.equal(errors.includes('webUI.port must be an integer between 1 and 65535'), true);
  assert.equal(errors.includes('managerServer.secret must contain at least 16 characters when enabled'), true);
  assert.equal(errors.includes('proxy.host must be a non-empty string'), true);
  assert.equal(errors.includes('asfPort must be an integer between 1 and 65535'), true);
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
