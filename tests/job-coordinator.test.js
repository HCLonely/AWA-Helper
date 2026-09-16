/**
 * @file tests/job-coordinator.test.js
 * @description 验证 Manager 作业去重与取消行为。
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  parse
} = require('yaml');
const {
  JobCoordinator
} = require('../dist/core/Manager/JobCoordinator');
const {
  ArtifactJob
} = require('../dist/core/Manager/jobs/ArtifactJob');
const {
  initializeI18n
} = require('../dist/tools/i18n');

initializeI18n('en', {
  en: parse(fs.readFileSync(path.resolve(__dirname, '../src/locales/en.yml'), 'utf8')),
  zh: parse(fs.readFileSync(path.resolve(__dirname, '../src/locales/zh.yml'), 'utf8'))
});

test('JobCoordinator deduplicates a running job', async () => {
  const coordinator = new JobCoordinator();
  let runs = 0;
  coordinator.register({
    name: 'dailyQuest',
    async run() {
      runs += 1;
      await new Promise((resolve) => setTimeout(resolve, 10));
      return true;
    }
  });
  const first = coordinator.start('dailyQuest');
  const second = coordinator.start('dailyQuest');
  assert.strictEqual(first, second);
  assert.equal((await first).success, true);
  assert.equal(runs, 1);
});

test('JobStateStore publishes isolated snapshots when job status changes', async () => {
  const coordinator = new JobCoordinator();
  const snapshots = [];
  coordinator.states.subscribe((states) => snapshots.push(states));
  coordinator.register({
    name: 'dailyQuest',
    run: async () => true
  });
  await coordinator.start('dailyQuest');
  assert.deepEqual(snapshots.map((states) => states[0].status), ['idle', 'running', 'completed']);
  snapshots[0][0].status = 'failed';
  assert.equal(coordinator.states.get('dailyQuest').status, 'completed');
});

test('JobCoordinator fails closed when a job omits its boolean result', async () => {
  const coordinator = new JobCoordinator();
  coordinator.register({
    name: 'dailyQuest',
    run: async () => undefined
  });

  const result = await coordinator.start('dailyQuest');

  assert.equal(result.success, false);
  assert.equal(coordinator.states.get('dailyQuest').status, 'failed');
});

test('JobCoordinator aborts jobs through Manager', async () => {
  const coordinator = new JobCoordinator();
  coordinator.register({
    name: 'dailyQuest',
    run(signal) {
      return new Promise((resolve) => signal.addEventListener('abort', () => resolve(false), {
        once: true
      }));
    }
  });
  const completion = coordinator.start('dailyQuest');
  await coordinator.stop('dailyQuest');
  const result = await completion;
  assert.equal(result.success, false);
  assert.equal(coordinator.states.get('dailyQuest').status, 'cancelled');
});

test('ArtifactJob rejects malformed artifact sets before accessing configuration', async () => {
  const job = new ArtifactJob('not-used-for-invalid-payload.yml');
  for (const payload of [[1, 2], [1, 1, 2], [1, 2, -3], [1, 2, 3, 4], ['1', 2, 3]]) {
    await assert.rejects(job.run(new AbortController().signal, payload), /Exactly three distinct positive artifact IDs/);
  }
});
