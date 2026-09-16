/**
 * @file tests/awa-parsers.test.js
 * @description 通过固定样本验证独立于 HTTP 接口的 AWA HTML 解析器。
 */
const assert = require('node:assert/strict');
const test = require('node:test');
const {
  parseAchievements,
  parseAvailableStreams,
  parseCommunityEvent,
  parsePersonalization,
  parseSteamQuestDetail,
  parseSteamQuestListings,
  parseSteamQuestProgress
} = require('../dist/client/AWA/parsers');

test('Steam quest parsers return structured list, detail, and progress data', () => {
  const list = '<div class="container"><div class="row"><a class="btn-steam-quest" href="/steam/quests/demo"></a><div class="media-body"><p>2 hours</p></div><span class="text-steam-light">15 ARP</span></div></div>';
  assert.deepEqual(parseSteamQuestListings(list, 'https://arena.example'), [{
    name: 'demo',
    link: 'https://arena.example/steam/quests/demo',
    time: 2,
    arp: 15
  }]);
  assert.deepEqual(parseSteamQuestDetail('<img src="https://cdn/steam/apps/123/header.jpg">Launch Game'), {
    appId: '123',
    state: 'ready'
  });
  assert.equal(parseSteamQuestProgress('<div aria-valuenow="75"></div>'), 75);
});

test('AWA feature parsers do not require a client singleton', () => {
  const streams = '<div class="user-profile__profile-card"><div class="user-profile__card-header">Watch Twitch</div><div class="user-profile__card-body"><div class="row"><div class="card-table-heading">Hive</div><div class="quest-list__stream-thumbnail"><a href="https://www.twitch.tv/hive_user"></a></div></div></div></div>';
  assert.deepEqual(parseAvailableStreams(streams), {
    Hive: ['hive_user'],
    Nexus: []
  });

  const personalization = '<script>var user_id = 7;</script><div class="account-personalization__personalization-item account-personalization__border" data-id="b1"><span class="account-personalization__name">Border</span><img src="/b.png"></div><div class="user-avatar"><img class="user-avatar__border" src="/b.png?x=1"></div>';
  assert.equal(parsePersonalization(personalization, 'border').userId, '7');
  assert.equal(parsePersonalization(personalization, 'border').selection.ids[0].id, 'b1');

  const achievements = '<div class="achievement-cards-collection-tab"><div class="stack-title">Twitch</div><div><div class="achievement-card"><span class="achievement-description-text">Watch streams</span></div></div></div>';
  assert.equal(parseAchievements(achievements)[0].description, 'Watch streams');

  const event = '<h1>Event Game</h1><a class="btn-steam-community-event" href="steam://run/456"></a><div class="progress-bar bg-info" aria-valuenow="10" aria-valuemax="60"></div>';
  assert.equal(parseCommunityEvent(event, 'demo').gameId, '456');
});
