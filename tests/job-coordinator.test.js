/** @description Verifies Manager job deduplication and cancellation. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { parse } = require('yaml');
const { JobCoordinator } = require('../dist/core/Manager/JobCoordinator');
const { initializeI18n } = require('../dist/tools/i18n');

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

test('JobCoordinator aborts jobs through Manager', async () => {
  const coordinator = new JobCoordinator();
  coordinator.register({
    name: 'dailyQuest',
    run(signal) {
      return new Promise((resolve) => signal.addEventListener('abort', () => resolve(false), { once: true }));
    }
  });
  const completion = coordinator.start('dailyQuest');
  await coordinator.stop('dailyQuest');
  const result = await completion;
  assert.equal(result.success, false);
  assert.equal(coordinator.states.get('dailyQuest').status, 'cancelled');
});
