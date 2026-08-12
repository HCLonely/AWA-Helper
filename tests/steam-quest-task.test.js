/** Behavioral tests for Steam quest and community event completion. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { DailyQuestRuntime } = require('../dist/core/DailyQuest/DailyQuestRuntime');
const { SteamQuestTask } = require('../dist/core/DailyQuest/tasks/SteamQuestTask');

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
