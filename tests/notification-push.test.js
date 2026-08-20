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

test('push formatter appends Battle Pass results without ARP formatting', () => {
  const messages = {
    battlePass: 'BattlePass',
    battlePassClaimed: (name, index, total) => `成功领取 ${name} (${index}/${total})`,
    battlePassClaimFailed: (name) => `领取 ${name} 失败`
  };
  global.__ = (key, ...args) => typeof messages[key] === 'function' ? messages[key](...args) : (messages[key] || key);
  const message = pushQuestInfoFormat({
    dailyArp: '0', signArp: {},
    report: { BattlePass: { status: '进行中', obtainedARP: 5, extraARP: 0, maxAvailableARP: 135 } },
    battlePass: {
      status: 'active',
      tokenCount: 5,
      tokenTotal: 135,
      claimed: [{ name: '15 Battle Tokens', index: 1, total: 12, milestoneId: 1 }],
      failed: [{ name: 'ARP Boost', milestoneId: 2, reason: 'rejected' }]
    }
  });
  assert.match(message, /BattlePass: 成功领取 15 Battle Tokens \(1\/12\)/);
  assert.match(message, /BattlePass: 领取 ARP Boost 失败/);
  assert.doesNotMatch(message, /BattlePass:\s+5 ARP/);
  assert.doesNotMatch(message, /BattlePass:.*ARP$/m);
});
