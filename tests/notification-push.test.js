/** Regression tests for DailyQuest push-message formatting. */
const assert = require('node:assert/strict');
const test = require('node:test');
const { pushQuestInfoFormat } = require('../dist/tools/notification');

test('push formatter does not append ARP twice to daily quest rewards', () => {
  global.__ = (key, value) => value === undefined ? key : `${key}[${value}]`;
  const message = pushQuestInfoFormat({
    dailyArp: '15',
    signArp: {},
    report: {
      'dailyTask[Example]': {
        status: 'done',
        obtainedARP: '15 ARP',
        extraARP: '0 ARP',
        maxAvailableARP: 15
      }
    }
  });

  assert.ok(message.includes('dailyTask[Example]:  15 ARP'));
  assert.doesNotMatch(message, /ARP\s+ARP/i);
  assert.doesNotMatch(message, /\+\s+0\s+ARP/i);
});
