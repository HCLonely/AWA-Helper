const assert = require('node:assert/strict');
const test = require('node:test');
const { deepMerge, validateHelperConfig } = require('../dist/tools/config/ConfigSchema');
const { Cookie } = require('../dist/tools');
const { getManagerListenHost } = require('../dist/server/network');
const { normalizeManagerConfig } = require('../dist/tools/config/ConfigMigration');
const { defaultConfig } = require('../dist/tools/config/ConfigLoader');

test('deepMerge preserves nested defaults', () => {
  const merged = deepMerge({ webUI: { enable: true, port: 2345, local: true } }, { webUI: { port: 8080 } });
  assert.deepEqual(merged, { webUI: { enable: true, port: 8080, local: true } });
});

test('WebUI defaults to port 2345', () => {
  assert.equal(defaultConfig.webUI.port, 2345);
});

test('HTTP debug logging defaults to disabled and validates as a boolean', () => {
  assert.deepEqual(defaultConfig.debug, { http: false });
  const base = {
    language: 'zh', awaHost: 'www.alienwarearena.com', awaQuests: [], awaDailyQuestType: [], webUI: { enable: false }
  };
  assert.deepEqual(validateHelperConfig({ ...base, debug: { http: true } }), []);
  assert.equal(validateHelperConfig({ ...base, debug: { http: 'true' } }).includes('debug.http must be a boolean'), true);
  assert.equal(validateHelperConfig({ ...base, debug: true }).includes('debug must be an object'), true);
});

test('legacy managerServer scheduling migrates without a second port', () => {
  const manager = normalizeManagerConfig({
    managerServer: {
      enable: true,
      secret: '1234567890123456',
      port: 2345,
      corn: '0 0 * * *',
      artifacts: [{ corn: '0 1 * * *', ids: '1, 2' }]
    }
  });
  assert.equal(manager.dailyQuestCron, '0 0 * * *');
  assert.deepEqual(manager.artifacts, [{ cron: '0 1 * * *', ids: [1, 2] }]);
  assert.equal(Object.hasOwn(manager, 'port'), false);
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
    webUI: { enable: true, port: 2345 },
    managerServer: { enable: false, secret: '', port: 2345 }
  };
  assert.equal(validateHelperConfig(deepMerge(defaults, { webUI: null })).includes('webUI must be an object'), true);
  assert.equal(validateHelperConfig(deepMerge(defaults, { managerServer: { enable: true, secret: 'short' } })).includes('managerServer.secret must contain at least 16 characters when enabled'), true);
  assert.equal(validateHelperConfig(deepMerge(defaults, { proxy: { enable: ['awa'], protocol: 'http', host: '', port: 99999 } })).includes('proxy.port must be an integer between 1 and 65535'), true);
  assert.equal(validateHelperConfig(deepMerge(defaults, { TLSRejectUnauthorized: 'false' })).includes('TLSRejectUnauthorized must be a boolean'), true);
});

test('Battle Pass is accepted as an optional awaQuests entry', () => {
  assert.deepEqual(validateHelperConfig({
    language: 'zh', awaHost: 'www.alienwarearena.com', awaQuests: ['dailyQuest', 'battlePass'],
    awaDailyQuestType: [], webUI: { enable: false }
  }), []);
});

test('manager artifact schedules require exactly three distinct positive IDs', () => {
  const base = {
    language: 'zh', awaHost: 'www.alienwarearena.com', awaQuests: [], awaDailyQuestType: [],
    webUI: { enable: false }
  };
  assert.deepEqual(validateHelperConfig({
    ...base, manager: { artifacts: [{ cron: '0 0 * * *', ids: [1, 2, 3] }] }
  }), []);
  for (const ids of [[1, 2], [1, 1, 2], [1, 2, -3], [1, 2, 3, 4]]) {
    assert.equal(validateHelperConfig({
      ...base, manager: { artifacts: [{ cron: '0 0 * * *', ids }] }
    }).includes('manager.artifacts must contain cron strings and exactly three distinct positive integer ids'), true);
  }
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
