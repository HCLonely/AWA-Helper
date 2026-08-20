/** Regression tests for cancellation during sequential DailyQuest operations. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { DailyTask } = require('../dist/core/DailyQuest/tasks/DailyTask');
const { LegacyDailyTask } = require('../dist/core/DailyQuest/tasks/LegacyDailyTask');
const { BattlePassTask } = require('../dist/core/DailyQuest/tasks/BattlePassTask');

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

test('BattlePassTask stops claiming and does not refresh after cancellation', async () => {
  const controller = new AbortController();
  let claims = 0;
  let pageLoads = 0;
  const rewards = [1, 2].map((milestoneId, index) => ({
    index, milestoneId, name: `Reward ${milestoneId}`, state: 'unlockable',
    claim: { path: `/claim/${milestoneId}`, csrfToken: 'token' }
  }));
  const runtime = {
    state: { battlePassUrl: 'https://example.test/battle-pass' },
    awa: { battlePass: {
      async getPage() {
        pageLoads += 1;
        return { status: 'active', claimedCount: 0, rewardTotal: 2, tokenCount: 0, tokenTotal: 10, rewards };
      },
      async claim() {
        claims += 1;
        controller.abort();
        return { ok: true, data: { success: true, milestoneId: 1, userMilestoneId: 1 } };
      }
    } }
  };

  assert.equal(await BattlePassTask.run(runtime, controller.signal), false);
  assert.equal(claims, 1);
  assert.equal(pageLoads, 1);
});

test('BattlePassTask inspect publishes claimed reward progress without claiming rewards', async () => {
  let claims = 0;
  const runtime = {
    state: { battlePassUrl: 'https://example.test/battle-pass' },
    awa: { battlePass: {
      async getPage() {
        return {
          status: 'active', claimedCount: 0, rewardTotal: 1, tokenCount: 45, tokenTotal: 135,
          rewards: [{ index: 0, milestoneId: 1, name: 'Reward', state: 'unlockable' }]
        };
      },
      async claim() {
        claims += 1;
      }
    } }
  };

  assert.equal(await BattlePassTask.inspect(runtime), true);
  assert.equal(runtime.state.battlePass.claimedCount, 0);
  assert.equal(runtime.state.battlePass.rewardTotal, 1);
  assert.equal(claims, 0);
});

test('BattlePassTask reports a claim only after the refreshed page marks it claimed', async () => {
  let pageLoads = 0;
  const reward = {
    index: 2, milestoneId: 12, name: 'ARP Boost', state: 'unlockable',
    claim: { path: '/claim/12', csrfToken: 'token' }
  };
  const otherRewards = [0, 1].map((index) => ({ index, milestoneId: index + 1, name: `Earlier ${index}`, state: 'claimed' }));
  const runtime = {
    state: { battlePassUrl: 'https://example.test/battle-pass' },
    awa: { battlePass: {
      async getPage() {
        pageLoads += 1;
        return {
          status: pageLoads === 1 ? 'active' : 'completed',
          claimedCount: pageLoads === 1 ? 2 : 3,
          rewardTotal: 3,
          tokenCount: 10,
          tokenTotal: 10,
          rewards: pageLoads === 1
            ? [...otherRewards, reward]
            : [...otherRewards, { ...reward, state: 'claimed', claim: undefined }]
        };
      },
      async claim() {
        return { ok: true, data: { success: true, milestoneId: 12, userMilestoneId: 42 } };
      }
    } }
  };

  assert.equal(await BattlePassTask.run(runtime), true);
  assert.deepEqual(runtime.state.battlePass.claimed, [{ name: 'ARP Boost', milestoneId: 12 }]);
  assert.equal(runtime.state.battlePass.claimedCount, 3);
  assert.equal(runtime.state.battlePass.rewardTotal, 3);
  assert.equal(runtime.state.battlePass.status, 'completed');
});
