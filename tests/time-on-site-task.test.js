/**
 * @file tests/time-on-site-task.test.js
 * @description 验证在线时长任务的上报与完成行为。
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const fixture = (cancelDuringCooldown = false) => {
  const controller = new AbortController();
  const waits = [];
  let requests = 0;
  const runtime = {
    state: {
      trackError: 0,
      trackTimes: 0,
      questInfo: {
        timeOnSite: {
          addedArp: '0',
          maxArp: '1'
        }
      }
    },
    async sendTimeOnSite() {
      requests++;
      if (requests <= 12) {
        this.state.trackError++;
        return false;
      }
      assert.equal(this.state.trackError, 0);
      this.state.trackTimes = 3;
      this.state.questInfo.timeOnSite.addedArp = '1';
      return true;
    }
  };
  const sandbox = {
    exports: {},
    __: (key) => key,
    require: (name) => name === '../../../tools' ? {
      Logger: class {},
      time: () => '',
      sleep: async (seconds, signal) => {
        waits.push({
          seconds,
          requests
        });
        assert.equal(signal, controller.signal);
        if (cancelDuringCooldown && seconds === 300) controller.abort();
        return !signal.aborted;
      }
    } : require(name)
  };
  vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../dist/core/DailyQuest/tasks/TimeOnSiteTask.js'), 'utf8'), sandbox);
  return {
    waits,
    runtime,
    requests: () => requests,
    run: () => sandbox.exports.TimeOnSiteTask.do(runtime, controller.signal)
  };
};

test('online heartbeat waits five minutes after each six failures and resumes until complete', async () => {
  const task = fixture();
  assert.equal(await task.run(), true);
  assert.equal(task.requests(), 13);
  assert.deepEqual(task.waits.filter(({
    seconds
  }) => seconds === 300), [
    {
      seconds: 300,
      requests: 6
    },
    {
      seconds: 300,
      requests: 12
    }
  ]);
  assert.equal(task.waits.length, 13);
  assert.ok(task.waits.every(({
    seconds, requests
  }) => seconds === (requests % 6 === 0 ? 300 : 60)));
});

test('online heartbeat can be stopped during the five-minute cooldown', async () => {
  const task = fixture(true);
  assert.equal(await task.run(), true);
  assert.equal(task.requests(), 6);
  assert.equal(task.waits.at(-1).seconds, 300);
});
