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
    battlePassRewardSeparator: '、',
    battlePassClaimed: (name, index, total) => `成功领取 ${name} (${index}/${total})`,
    battlePassClaimFailed: (name) => `领取 ${name} 失败`
  };
  global.__ = (key, ...args) => typeof messages[key] === 'function' ? messages[key](...args) : (messages[key] || key);
  const message = pushQuestInfoFormat({
    dailyArp: '0', signArp: {},
    report: { BattlePass: { status: '进行中', obtainedARP: 4, extraARP: 0, maxAvailableARP: 12 } },
    battlePass: {
      status: 'active',
      claimedCount: 4,
      rewardTotal: 12,
      claimed: [
        { name: '15 Battle Tokens', milestoneId: 1 },
        { name: 'ARP Boost', milestoneId: 2 }
      ],
      failed: [{ name: 'Mystery Reward', milestoneId: 3, reason: 'rejected' }]
    }
  });
  assert.match(message, /BattlePass: 成功领取 15 Battle Tokens、ARP Boost \(4\/12\)/);
  assert.match(message, /BattlePass: 领取 Mystery Reward 失败/);
  assert.doesNotMatch(message, /BattlePass:\s+4 ARP/);
  assert.doesNotMatch(message, /BattlePass:.*ARP$/m);
});

test('push formatter always includes Battle Pass progress except for not-started and ended states', () => {
  const messages = {
    battlePass: 'BattlePass',
    battlePassProgress: (current, total) => `奖励领取进度 (${current}/${total})`,
    battlePassStatusProgress: (status, current, total) => `${status} (${current}/${total})`,
    'battlePassStatus_completed': '已完成',
    'battlePassStatus_unknown': '未知',
    'battlePassStatus_not-started': '未开始',
    'battlePassStatus_ended': '已结束'
  };
  global.__ = (key, ...args) => typeof messages[key] === 'function' ? messages[key](...args) : (messages[key] || key);
  const format = (status, claimedCount, rewardTotal) => pushQuestInfoFormat({
    dailyArp: '0', signArp: {}, report: {},
    battlePass: { status, claimedCount, rewardTotal, claimed: [], failed: [] }
  });

  assert.match(format('active', 3, 12), /BattlePass: 奖励领取进度 \(3\/12\)/);
  assert.match(format('completed', 12, 12), /BattlePass: 已完成 \(12\/12\)/);
  assert.match(format('unknown', 2, 12), /BattlePass: 未知 \(2\/12\)/);
  assert.match(format('not-started', 0, 12), /BattlePass: 未开始(?:\n|$)/);
  assert.doesNotMatch(format('not-started', 0, 12), /\(0\/12\)/);
  assert.match(format('ended', 7, 12), /BattlePass: 已结束(?:\n|$)/);
  assert.doesNotMatch(format('ended', 7, 12), /\(7\/12\)/);
});
