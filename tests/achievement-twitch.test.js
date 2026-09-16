/** Behavioral tests for long-running Achievement Twitch heartbeats. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { AchievementService } = require('../dist/core/Achievement/AchievementService');
const { TwitchClient } = require('../dist/client/Twitch/TwitchClient');
const { flushLogs } = require('../dist/tools/logging/LogWriter');

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

test.after(async () => {
  await flushLogs();
  process.chdir(originalDirectory);
  fs.rmSync(temporaryDirectory, { recursive: true, force: true });
});

for (const ending of ['completed', 'cancelled', 'unlinked']) {
  test(`Achievement refreshes Twitch credentials after five heartbeats until ${ending}`, async (t) => {
    const description = 'Watch 1000 Hours of Twitch.tv on Hive channels';
    const service = Object.create(AchievementService.prototype);
    const controller = new AbortController();
    let now = 1800000000000;
    let lookupCount = 0;
    let goalChecks = 0;
    const heartbeats = [];
    t.mock.method(Date, 'now', () => now);
    t.mock.getter(TwitchClient.prototype, 'session', () => ({ verify: async () => 'ok' }));
    t.mock.getter(TwitchClient.prototype, 'extensions', () => ({
      checkLinked: async () => ({ ok: ending !== 'unlinked' || lookupCount === 0 })
    }));
    t.mock.getter(TwitchClient.prototype, 'channels', () => ({
      findTracking: async () => {
        lookupCount++;
        const payload = Buffer.from(JSON.stringify({ exp: now / 1000 + 330 })).toString('base64url');
        return { found: true, value: { channelId: '42', jwt: `header.${payload}.signature`, streamerName: 'streamer' } };
      }
    }));
    service.watchTwitchStatus = { running: false, type: new Set() };
    service.twitchCookie = 'auth-token=test';
    service.availableAchievements = [description];
    service.Achievements = [{ description, completed: false }];
    service.incompletedAchievements = [];
    service.achievement2action = { [description]: () => service.addWatchTwitch('hive') };
    service.awa = {
      context: {},
      achievement: {
        getAll: async () => {
          goalChecks++;
          return [{ description, completed: heartbeats.length >= 10 }];
        }
      },
      twitch: {
        getAvailableStreams: async () => ({ Hive: ['streamer'], Nexus: [] }),
        sendTrack: async (info) => {
          heartbeats.push(info.jwt);
          now += 60000;
          if (ending === 'cancelled' && heartbeats.length === 6) controller.abort();
          // Bound the test if completion polling regresses.
          if (heartbeats.length > 10) controller.abort();
          return { success: true, state: 'daily_cap_reached' };
        }
      }
    };
    const track = service.trackTwitchChannel.bind(service);
    t.mock.method(service, 'trackTwitchChannel', (info, signal) => track(info, signal, 0.001));

    const result = await service.run(controller.signal);

    assert.equal(result.status, ending === 'unlinked' ? 'partial' : ending);
    assert.equal(heartbeats.length, ending === 'completed' ? 10 : ending === 'cancelled' ? 6 : 5);
    if (ending !== 'unlinked') {
      assert.equal(lookupCount, 2);
      assert.notEqual(heartbeats[4], heartbeats[5], 'the sixth heartbeat must use refreshed credentials');
      assert.equal(goalChecks, ending === 'completed' ? 2 : 1);
    }
    assert.equal(service.watchTwitchStatus.type.size, ending === 'completed' ? 0 : 1);
    assert.equal(service.twitch, null);
  });
}

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
