/** Behavioral tests for long-running Achievement Twitch heartbeats. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { AchievementService } = require('../dist/core/Achievement/AchievementService');

const originalDirectory = process.cwd();
const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'awa-achievement-twitch-'));

test.before(() => {
  process.chdir(temporaryDirectory);
  fs.mkdirSync('logs');
  global.__ = (key, value) => value ? `${key}: ${value}` : key;
  global.log = false;
  global.webUI = false;
  global.logs = { type: 'logs' };
  global.wsClients = new Set();
});

test.after(() => {
  process.chdir(originalDirectory);
  fs.rmSync(temporaryDirectory, { recursive: true, force: true });
});

for (const unavailableState of ['streamer_offline', 'no_channel_found']) {
  test(`Achievement Twitch ignores daily_cap_reached and retries after ${unavailableState}`, async () => {
    const service = Object.create(AchievementService.prototype);
    const states = ['daily_cap_reached', unavailableState];
    let heartbeatCount = 0;
    service.watchTwitchStatus = { running: true, type: new Set(['hive']) };
    service.awa = {
      twitch: {
        async sendTrack() {
          const state = states[heartbeatCount++];
          return { success: state === 'daily_cap_reached', state };
        }
      }
    };

    const result = await service.trackTwitchChannel(
      { channelId: '42', jwt: 'token', streamerName: 'streamer' },
      undefined,
      0.001
    );

    assert.equal(heartbeatCount, 2);
    assert.equal(result, 'retry');
  });
}
