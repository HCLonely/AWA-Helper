/**
 * @file tests/battle-pass-parser.test.js
 * @description 回归验证纯函数形式的 AWA 战斗通行证解析器。
 */
const assert = require('node:assert/strict');
const test = require('node:test');
const {
  parseBattlePass, isBattlePassEnded, isBattlePassNotStarted
} = require('../dist/client/AWA/parsers');
const {
  load
} = require('cheerio');

test('Battle Pass parser extracts status, tokens, rewards and claim form data', () => {
  const html = `
    <strong class="bp-header__token-count">0</strong>
    <strong class="bp-header__token-total">135</strong>
    <strong class="bp-header__countdown" data-countdown="2026-08-25T00:00:00+00:00"></strong>
    <div class="bp-header__started">Your Battle Pass Has Started!</div>
    <div class="bp-marker bp-marker--unlockable" data-index="0" data-milestone-id="1" data-state="unlockable" title="15 Battle Tokens">
      <div class="bp-popup">
        <h3 class="bp-popup__title">15 Battle Tokens</h3>
        <img class="bp-popup__image" src="https://media.example/reward.png">
        <p class="bp-popup__desc">Tokens</p>
        <div class="bp-popup__arp">25 ARP Required</div>
        <form method="post" action="/battle-pass/claim/251538" data-claim-form>
          <input type="hidden" name="_csrf_token" value="csrf.token">
        </form>
      </div>
    </div>
    <div class="bp-marker" data-index="1" data-milestone-id="11" data-state="in_progress" title="Artifact">
      <div class="bp-popup"><div class="bp-popup__progress-text">11/25</div></div>
    </div>
    <div class="bp-marker" data-index="2" data-milestone-id="12" data-state="claimed" title="Claimed"></div>`;

  const result = parseBattlePass(html);
  assert.equal(result.status, 'active');
  assert.equal(result.tokenCount, 0);
  assert.equal(result.tokenTotal, 135);
  assert.equal(result.claimedCount, 1);
  assert.equal(result.rewardTotal, 3);
  assert.equal(result.endsAt, '2026-08-25T00:00:00+00:00');
  assert.deepEqual(result.rewards[0].claim, {
    path: '/battle-pass/claim/251538',
    csrfToken: 'csrf.token'
  });
  assert.equal(result.rewards[0].requiredArp, 25);
  assert.deepEqual(result.rewards[1].progress, {
    current: 11,
    total: 25
  });
  assert.equal(result.rewards[1].claim, undefined);
});

test('Battle Pass completed state takes precedence and reserved state detectors stay conservative', () => {
  const completed = parseBattlePass(`
    <div class="bp-header__started"></div><div class="bp-header__completed"></div>
    <div class="bp-marker" data-milestone-id="1" data-state="claimed"></div>
    <div class="bp-marker" data-milestone-id="2" data-state="locked"></div>`);
  assert.equal(completed.status, 'completed');
  assert.equal(completed.claimedCount, 1);
  assert.equal(completed.rewardTotal, 2);
  const $ = load('<main></main>');
  assert.equal(isBattlePassNotStarted($), false);
  assert.equal(isBattlePassEnded($), false);
  assert.equal(parseBattlePass('<main></main>').status, 'unknown');
});

test('unlockable reward without complete request data is not claimable', () => {
  const result = parseBattlePass('<div class="bp-marker" data-index="2" data-milestone-id="12" data-state="unlockable"><form data-claim-form action="/claim"></form></div>');
  assert.equal(result.rewards[0].claim, undefined);
});
