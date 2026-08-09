/** Behavioral tests for retrying unavailable Twitch streams. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { TwitchQuestTask } = require('../dist/core/DailyQuest/tasks/TwitchQuestTask');

const originalDirectory = process.cwd();
const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'awa-twitch-task-'));
test.before(() => {
  process.chdir(temporaryDirectory);
  fs.mkdirSync('logs');
});
test.after(() => {
  process.chdir(originalDirectory);
  fs.rmSync(temporaryDirectory, { recursive: true, force: true });
});

test('TwitchQuestTask reloads streams after an empty result instead of failing', async () => {
  global.__ = (key) => key;
  global.log = false;
  global.webUI = false;
  global.logs = { type: 'logs' };
  global.wsClients = new Set();
  let streamRequests = 0;
  let channelRequests = 0;
  const runtime = { state: { questInfo: {}, additionalTwitchARP: 0 } };
  const awa = {
    async getAvailableStreams() {
      streamRequests += 1;
      return streamRequests === 1 ? { Hive: [], Nexus: [] } : { Hive: ['streamer'], Nexus: [] };
    },
    async sendTwitchTrack() {
      return { success: true, state: 'daily_cap_reached' };
    }
  };
  const twitch = {
    async findTrackingChannel() {
      channelRequests += 1;
      return { channelId: '42', jwt: 'token', streamerName: 'streamer' };
    }
  };
  const task = new TwitchQuestTask(runtime, awa, twitch, 0);
  assert.equal(await task.run(), true);
  assert.equal(streamRequests, 2);
  assert.equal(channelRequests, 1);
});

test('TwitchQuestTask treats channels without a tracking extension as retryable unavailability', async () => {
  global.__ = (key) => key;
  global.log = false;
  global.webUI = false;
  let streamRequests = 0;
  let channelRequests = 0;
  const runtime = { state: { questInfo: {}, additionalTwitchARP: 0 } };
  const awa = {
    async getAvailableStreams() {
      streamRequests += 1;
      return { Hive: ['streamer'], Nexus: [] };
    },
    async sendTwitchTrack() {
      return { success: true, state: 'daily_cap_reached' };
    }
  };
  const twitch = {
    async findTrackingChannel() {
      channelRequests += 1;
      return channelRequests === 1 ? null : { channelId: '42', jwt: 'token', streamerName: 'streamer' };
    }
  };
  const task = new TwitchQuestTask(runtime, awa, twitch, 0);
  assert.equal(await task.run(), true);
  assert.equal(streamRequests, 2);
  assert.equal(channelRequests, 2);
});
