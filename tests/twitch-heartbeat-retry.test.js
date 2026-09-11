const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const test = require('node:test');
const vm = require('node:vm');
const axios = require('axios');
const { AWAError } = require('../dist/client/AWA/AWAError');

const fixture = (outcomes, cancelAtCooldown = false) => {
  const controller = new AbortController();
  const waits = [];
  let requests = 0;
  let verifications = 0;
  const runtime = { state: { questInfo: {}, additionalTwitchARP: 0 } };
  const awa = { twitch: {
    getAvailableStreams: async () => ({ Hive: ['streamer'], Nexus: [] }),
    sendTrack: async () => {
      const outcome = outcomes[requests++];
      if (outcome instanceof Error) throw outcome;
      if (!outcome) runtime.state.questInfo.watchTwitch = ['15', '0'];
      return outcome || { success: true, state: 'daily_cap_reached' };
    }
  } };
  const twitch = {
    channels: { findTracking: async () => ({ found: true, value: { channelId: '42', jwt: 'token' } }) },
    session: { verify: async () => { verifications++; } },
    extensions: { checkLinked: async () => ({ ok: true }) }
  };
  const filename = path.resolve(__dirname, '../dist/core/DailyQuest/tasks/TwitchQuestTask.js');
  const localRequire = createRequire(filename);
  const sandbox = {
    exports: {},
    __: (key) => key,
    AbortController,
    require: (name) => name === '../../../tools' ? {
      Logger: class { log() {} },
      time: () => '',
      sleep: async (seconds, signal) => {
        waits.push({ seconds, requests });
        assert.equal(signal, controller.signal);
        if (cancelAtCooldown && seconds === 300) controller.abort();
        return !signal.aborted;
      }
    } : localRequire(name)
  };
  vm.runInNewContext(fs.readFileSync(filename, 'utf8'), sandbox);
  const task = new sandbox.exports.TwitchQuestTask(runtime, awa, twitch);
  return { waits, requests: () => requests, verifications: () => verifications, run: () => task.run(controller.signal) };
};

const networkError = () => new AWAError('request', 'network unavailable', true);

test('Twitch heartbeat retries each six network failures after five minutes, then recovers', async () => {
  const task = fixture(Array.from({ length: 12 }, networkError));
  assert.equal(await task.run(), true);
  assert.equal(task.requests(), 13);
  assert.deepEqual(task.waits, Array.from({ length: 12 }, (_, index) => ({
    seconds: (index + 1) % 6 === 0 ? 300 : 60, requests: index + 1
  })));
});

test('successful Twitch heartbeat resets consecutive network failures', async () => {
  const task = fixture([
    ...Array.from({ length: 5 }, networkError),
    { success: true, state: 'streamer_online' },
    ...Array.from({ length: 6 }, networkError)
  ]);
  assert.equal(await task.run(), true);
  assert.deepEqual(task.waits.filter(({ seconds }) => seconds === 300), [{ seconds: 300, requests: 12 }]);
});

test('Twitch heartbeat stops during the five-minute cooldown without another request', async () => {
  const task = fixture(Array.from({ length: 6 }, networkError), true);
  assert.equal(await task.run(), true);
  assert.equal(task.requests(), 6);
  assert.equal(task.waits.at(-1).seconds, 300);
});

test('Twitch heartbeat retries Axios network failures and temporary HTTP failures', async () => {
  const task = fixture([
    new axios.AxiosError('timeout', 'ETIMEDOUT'),
    ...[408, 429, 503].map((status) => new AWAError('request', 'temporary failure', false, status))
  ]);
  assert.equal(await task.run(), true);
  assert.equal(task.requests(), 5);
  assert.ok(task.waits.every(({ seconds }) => seconds === 60));
});

test('Twitch heartbeat retains one authorization retry for repeated 403 responses', async () => {
  const task = fixture(Array.from({ length: 2 }, () => new AWAError('request', 'forbidden', false, 403)));
  assert.equal(await task.run(), false);
  assert.equal(task.requests(), 2);
  assert.equal(task.verifications(), 1);
});

test('Twitch heartbeat still ends on permanent errors and unsuccessful business responses', async () => {
  for (const outcome of [new AWAError('request', 'unauthorized', false, 401), { success: false, state: 'unknown' }]) {
    const task = fixture([outcome]);
    assert.equal(await task.run(), false);
    assert.equal(task.requests(), 1);
    assert.deepEqual(task.waits, []);
  }
});
