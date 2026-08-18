/** Regression tests for cancellation during sequential DailyQuest operations. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { DailyTask } = require('../dist/core/DailyQuest/tasks/DailyTask');
const { LegacyDailyTask } = require('../dist/core/DailyQuest/tasks/LegacyDailyTask');

const originalDirectory = process.cwd();
const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'awa-daily-cancellation-'));

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

test('DailyTask does not refresh or continue after cancellation', async () => {
  const controller = new AbortController();
  let refreshes = 0;
  const runtime = {
    state: {
      questInfo: { dailyQuest: [{ id: '1', name: 'Quest', status: 'incomplete' }] }
    },
    async claimQuest() {
      controller.abort();
    },
    async updateDailyQuests() {
      refreshes += 1;
    }
  };

  assert.equal(await new DailyTask(runtime).do(controller.signal), false);
  assert.equal(refreshes, 0);
});

test('LegacyDailyTask stops before recording or refreshing the next action', async () => {
  const controller = new AbortController();
  let refreshes = 0;
  let visits = 0;
  const runtime = {
    state: {
      questInfo: { dailyQuest: [{ name: 'Quest', status: 'incomplete' }] }
    },
    awa: { context: { baseURL: 'https://example.test' } },
    async visit() {
      visits += 1;
      controller.abort();
    },
    async updateDailyQuests() {
      refreshes += 1;
    }
  };
  const task = new LegacyDailyTask(runtime, {});
  task.matchQuest = () => ['/rewards'];

  await task.do(controller.signal);

  assert.equal(visits, 1);
  assert.equal(refreshes, 0);
  assert.deepEqual(task.done, []);
});
