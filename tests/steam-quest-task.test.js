/** Behavioral tests for Steam quest and community event completion. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { DailyQuestRuntime } = require('../dist/core/DailyQuest/DailyQuestRuntime');
const { SteamQuestTask } = require('../dist/core/DailyQuest/tasks/SteamQuestTask');
const { formatQuestFailure } = require('../dist/core/DailyQuest/QuestFailure');
const { ASFError } = require('../dist/client/Steam/ASFError');
const { setLogSecrets } = require('../dist/tools/logging/sanitize');

const originalDirectory = process.cwd();
const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'awa-steam-task-'));
test.before(() => {
  process.chdir(temporaryDirectory);
  fs.mkdirSync('logs');
  global.__ = (key) => key;
  global.log = false;
  global.webUI = false;
  global.logs = { type: 'logs' };
  global.wsClients = new Set();
});
test.after(() => {
  process.chdir(originalDirectory);
  fs.rmSync(temporaryDirectory, { recursive: true, force: true });
});

test('SteamQuestTask stops after a running community event becomes complete', async () => {
  let eventAppId = '123';
  let progressChecks = 0;
  let stopped = false;
  const awa = {
    steam: {
      async getSteamQuests() {
        return [{ name: 'Quest', time: 1, arp: 1, link: '/steam/quest' }];
      },
      async getQuestDetail() {
        return { state: 'ready', appId: '456' };
      },
      async getQuestProgress() {
        progressChecks += 1;
        eventAppId = undefined;
        return { found: true, value: 100 };
      }
    }
  };
  const asf = {
    licenses: { async add() { return { ok: true }; } },
    bot: {
      async getOwnedGames() { return ['123', '456']; },
      async playGames() { return { ok: true }; },
      async stopGames() { stopped = true; return { ok: true }; }
    }
  };

  const task = new SteamQuestTask(awa, asf, () => eventAppId, 0);
  assert.equal(await task.run(), true);
  assert.equal(progressChecks, 1);
  assert.equal(stopped, true);
});

test('SteamQuestTask does not start ASF for an already completed community event', async () => {
  let licenseRequests = 0;
  const awa = { steam: { async getSteamQuests() { return []; } } };
  const asf = {
    licenses: { async add() { licenseRequests += 1; return { ok: true }; } },
    bot: {}
  };

  const task = new SteamQuestTask(awa, asf, () => undefined, 0);
  assert.equal(await task.run(), true);
  assert.equal(licenseRequests, 0);
});

for (const stage of ['listing', 'license', 'owned', 'play', 'progress']) {
  test(`Steam failure retains the cause at ${stage} and still cleans up playback`, async () => {
    const failure = new ASFError('executeCommand', 'Connection failed', true, 503, {
      cause: Object.assign(new Error('connect ECONNREFUSED'), { code: 'ECONNREFUSED' })
    });
    const at = (name, value) => async () => { if (stage === name) throw failure; return value; };
    let stopped = false;
    const awa = { steam: {
      getSteamQuests: at('listing', [{ name: 'Game', link: '/quest' }]),
      getQuestDetail: async () => ({ state: 'ready', appId: '123' }),
      getQuestProgress: at('progress', { found: true, value: 100 })
    } };
    const asf = { licenses: { add: at('license', { ok: true }) }, bot: {
      getOwnedGames: at('owned', ['123']), playGames: at('play', { ok: true }),
      stopGames: async () => { stopped = true; throw new Error('cleanup failed'); }
    } };
    await assert.rejects(new SteamQuestTask(awa, asf, () => undefined, 0).run(), (error) => {
      assert.equal(error.cause, failure);
      const message = formatQuestFailure('Steam ASF', error);
      assert.match(message, /Steam ASF/);
      assert.match(message, /executeCommand: 503: Connection failed/);
      assert.match(message, /ECONNREFUSED/);
      assert.doesNotMatch(message, /cleanup failed/);
      return true;
    });
    assert.equal(stopped, ['play', 'progress'].includes(stage));
  });
}

test('failure summaries redact secrets and handle missing or circular causes', () => {
  setLogSecrets({ asfPassword: 'private-asf-password' });
  const error = new Error('private-asf-password');
  error.cause = error;
  assert.equal(formatQuestFailure('Steam ASF', error), 'Steam ASF: ********');
  assert.equal(formatQuestFailure('Steam ASF', undefined), 'Steam ASF: taskFailureUnknown');
  assert.equal(formatQuestFailure('Steam ASF', 'request failed'), 'Steam ASF: request failed');
});

test('DailyQuestRuntime does not expose a game ID for an already completed community event', async () => {
  const runtime = new DailyQuestRuntime({ awaCookie: '', host: 'example.com', joinSteamCommunityEvent: true });
  runtime.awa.communityEvent.findPath = async () => ({ found: true, value: 'event' });
  runtime.awa.communityEvent.getEvent = async () => ({
    path: 'event', concluded: false, closed: false, gameId: '123', gameName: 'Game',
    started: true, playedMinutes: 912, totalMinutes: 600
  });

  await runtime.initializeCommunityEvent();
  assert.deepEqual(runtime.state.communityEvent, {
    path: 'event', status: 'done', playedTime: '912', totalTime: '600min'
  });
});
