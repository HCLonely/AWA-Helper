const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { runWithRequestSignal } = require('../dist/tools/http/RequestContext');

const fixture = ({ cancelDuringSetup = false, failSetup = false, failPush = false, failCommit = false, questError } = {}) => {
  const controller = new AbortController();
  const events = [];
  let releaseChild;
  const childReleased = new Promise((resolve) => { releaseChild = resolve; });
  let commits = 0;
  class Runtime {
    constructor() {
      this.state = { questInfo: { timeOnSite: { addedArp: 0, maxArp: 1 } }, additionalTwitchARP: 0 };
      this.awa = {};
      this.newCookie = 'refreshed';
    }
    async init() { return { ok: true }; }
    async loadTwitchBonus() { throw new Error('setup failed'); }
    async monitor(signal) {
      events.push('monitor started');
      await new Promise((resolve) => signal.addEventListener('abort', resolve, { once: true }));
      events.push('monitor stopped');
    }
  }
  class Logger { constructor(message) { events.push(message); } log() {} }
  const dependencies = {
    './DailyQuestRuntime': { DailyQuestRuntime: Runtime },
    './QuestReporter': { formatQuestReport: () => ({}) },
    './QuestFailure': require('../dist/core/DailyQuest/QuestFailure'),
    './tasks/TimeOnSiteTask': { TimeOnSiteTask: { do: async (_runtime, signal) => {
      events.push('child started');
      if (questError) throw questError;
      if (!cancelDuringSetup && !failSetup) { events.push('child finished'); return true; }
      await new Promise((resolve) => signal.addEventListener('abort', resolve, { once: true }));
      events.push('child cancelled');
      await childReleased;
      events.push('child finished');
      return false;
    } } },
    '../../tools': {
      Logger, time: () => '', configureWebUiColors: () => {}, checkUpdate: async () => {},
      pushQuestInfoFormat: () => '', push: async (message) => { events.push(`push: ${message}`); if (failPush) throw new Error('push failed'); },
      sleep: async () => { if (cancelDuringSetup) controller.abort(); return !controller.signal.aborted; }
    },
    '../../tools/config': { loadConfig: () => ({ path: 'synthetic.yml', raw: {
      language: 'en', awaCookie: 'old', awaQuests: ['timeOnSite', ...(failSetup ? ['watchTwitch'] : [])], webUI: { enable: false }
    } }) },
    '../../tools/config/YamlConfig': { createCookieCommit: () => () => {
      commits++; events.push('cookie committed');
      if (failCommit && commits > 1) throw new Error('disk write failed');
    } },
    '../../tools/http/RequestContext': { runWithRequestSignal },
    '../../tools/logging/sanitize': { setLogSecrets: () => {} },
    '../../tools/logging/retention': { cleanupExpiredLogs: () => {} },
    '../../client/shared': { DEFAULT_AWA_HOST: 'www.alienwarearena.com', DEFAULT_USER_AGENT: 'test' },
    i18n: { configure: () => {}, setLocale: () => {} },
    fs: { existsSync: () => false }
  };
  dependencies['../../tools/config/RunConfiguration'] = { hasRunConfiguration: () => false, getRunConfiguration: dependencies['../../tools/config'].loadConfig, createSessionCommit: dependencies['../../tools/config/YamlConfig'].createCookieCommit };
  const sandbox = {
    exports: {}, require: (name) => dependencies[name] || (name === 'chalk' ? require('chalk') : {}),
    globalThis: {}, __: (key) => key, process: { argv: [], env: {} }, AbortController, AbortSignal, setTimeout, clearTimeout
  };
  vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../dist/core/DailyQuest/DailyQuestRunner.js'), 'utf8'), sandbox);
  return { events, controller, releaseChild, run: () => sandbox.exports.runDailyQuest({ signal: controller.signal }) };
};

for (const options of [{ cancelDuringSetup: true }, { failSetup: true }]) {
  test(`DailyQuest awaits early child cleanup before return or setup failure: ${JSON.stringify(options)}`, async () => {
    const run = fixture(options);
    let completed = false;
    const pending = run.run().then(() => { completed = true; }, () => { completed = true; });
    await new Promise(setImmediate);
    assert.equal(completed, false);
    assert.ok(run.events.includes('child cancelled'));
    run.releaseChild();
    await pending;
    assert.equal(completed, true);
    assert.ok(run.events.lastIndexOf('cookie committed') > run.events.indexOf('child finished'));
  });
}

test('DailyQuest stops its monitor when completion notification throws', async () => {
  const run = fixture({ failPush: true });
  await assert.rejects(run.run(), /push failed/);
  assert.ok(run.events.includes('monitor stopped'));
  assert.ok(run.events.lastIndexOf('cookie committed') > run.events.indexOf('monitor stopped'));
});

test('DailyQuest stops its monitor before a final cookie write failure', async () => {
  const run = fixture({ failCommit: true });
  await assert.rejects(run.run(), /disk write failed/);
  assert.ok(run.events.includes('monitor stopped'));
});

test('DailyQuest logs rejected task reasons immediately and includes them in the final push', async () => {
  const run = fixture({ questError: new Error('connection refused') });
  assert.equal(await run.run(), false);
  const logged = run.events.findIndex((event) => typeof event === 'string' && event.includes('AWA TimeOnSite: connection refused'));
  assert.ok(logged >= 0 && logged < run.events.indexOf('monitor started'));
  const notifications = run.events.filter((event) => typeof event === 'string' && event.startsWith('push:'));
  assert.equal(notifications.length, 1);
  assert.match(notifications[0], /processError: AWA TimeOnSite: connection refused/);
});
