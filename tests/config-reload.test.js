/**
 * @file tests/config-reload.test.js
 * @description 验证保存的 WebUI 配置会应用到正在运行的 Manager 调度器。
 */
const assert = require('node:assert/strict');
const test = require('node:test');
const {
  Scheduler
} = require('../dist/core/Manager/Scheduler');

globalThis.__ = (key) => key;
globalThis.webUI = false;
globalThis.log = false;

const managerConfig = (dailyQuestCron, achievement = false) => ({
  secret: '1234567890123456',
  dailyQuestCron,
  achievement: {
    enable: achievement,
    cron: '0 2 * * *'
  },
  artifacts: []
});

test('Scheduler reload replaces active cron tasks without duplicating them', () => {
  const scheduler = new Scheduler({}, managerConfig('0 1 * * *'));
  try {
    scheduler.start();
    assert.equal(scheduler.tasks.length, 1);

    scheduler.reload(managerConfig(undefined, true));
    assert.equal(scheduler.tasks.length, 1);
    assert.equal(scheduler.config.achievement.enable, true);

    scheduler.reload(managerConfig(undefined, false));
    assert.equal(scheduler.tasks.length, 0);
  } finally {
    scheduler.stop();
  }
});

test('Scheduler reload does not start cron tasks before Manager starts scheduling', () => {
  const scheduler = new Scheduler({}, managerConfig(undefined));
  try {
    scheduler.reload(managerConfig('0 1 * * *'));
    assert.equal(scheduler.tasks.length, 0);
    scheduler.start();
    assert.equal(scheduler.tasks.length, 1);
  } finally {
    scheduler.stop();
  }
});
