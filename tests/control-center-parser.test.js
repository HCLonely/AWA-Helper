/** Regression tests for the pure AWA control-center parser. */
const assert = require('node:assert/strict');
const test = require('node:test');
const { parseControlCenter } = require('../dist/client/AWA/parsers');

test('control-center parser returns structured quest state without a client singleton', () => {
  const html = `
    <script>
      let user_country = "CN";
      let user_profile_url = "/member/test";
      let dailyArpData = {"timeOnSiteCap":5,"timeOnSiteArp":2,"dailyArp":7,"twitchData":{"totalPoints":3,"bonusPoints":1}};
    </script>
    <div class="user-profile__card-body">
      <div class="card-table-row">
        <a class="quest-title" data-award-on-click="true" data-quest-id="42" href="/ajax/task">Daily task</a>
        <span class="quest-item-progress">incomplete</span><span class="quest-item-progress">5 ARP</span>
      </div>
      <div class="card-table-row"><a href="/quests/special" class="quest-title">Special</a><span class="quest-item-progress">10 + 2 ARP</span></div>
    </div>
    <div class="user-profile__card-body"></div>
    <div class="featured-row-News"><a href="/ucf/show/123"></a></div>`;
  const result = parseControlCenter(html, 'https://www.alienwarearena.com');
  assert.equal(result.userProfileUrl, '/member/test');
  assert.equal(result.dailyArp, '7');
  assert.deepEqual(result.questInfo.watchTwitch, ['3', '1']);
  assert.equal(result.questInfo.dailyQuest[0].id, '42');
  assert.equal(result.questInfo.dailyQuestUS[0].link, 'https://www.alienwarearena.com/quests/special');
  assert.deepEqual(result.posts, ['123']);
});
