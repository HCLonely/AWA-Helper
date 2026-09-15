const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { parse } = require('yaml');
const axios = require('axios');
const { createCookieCommit, updateYamlFieldsSync } = require('../dist/tools/config/YamlConfig');
const { JobCoordinator } = require('../dist/core/Manager/JobCoordinator');
const { Scheduler } = require('../dist/core/Manager/Scheduler');
const { AWAContext } = require('../dist/client/AWA/AWAContext');
const { refreshSession } = require('../dist/client/AWA/APIs/session/refreshSession');
const { TwitchContext } = require('../dist/client/Twitch/TwitchContext');
const { ASFContext } = require('../dist/client/Steam/ASFContext');
const { runWithRequestSignal } = require('../dist/tools/http/RequestContext');
const { http, retryDelayMs } = require('../dist/tools/http/client');
const { sendWebUiMessage, MAX_WS_BUFFER } = require('../dist/tools/logging/WebSocketLimits');
const { cleanupCompletedUpdates } = require('../dist/tools/update/retention');
const { flushLogs, Logger, getLogFilePath } = require('../dist/tools/logging');
const { cleanupExpiredLogs } = require('../dist/tools/logging/retention');
const { AchievementService } = require('../dist/core/Achievement/AchievementService');
const { ArtifactService } = require('../dist/core/Artifact/ArtifactService');
const { TwitchQuestTask } = require('../dist/core/DailyQuest/tasks/TwitchQuestTask');
const { verifySession } = require('../dist/client/Twitch/APIs/session/verifySession');
const { SteamQuestTask } = require('../dist/core/DailyQuest/tasks/SteamQuestTask');
const { claimQuestAward } = require('../dist/client/AWA/APIs/quests/claimQuestAward');
const { completeGetStartedItem } = require('../dist/client/AWA/APIs/quests/completeGetStartedItem');
const { SteamQuestAPI } = require('../dist/client/AWA/APIs/steam/SteamQuestAPI');
const { CommunityEventAPI } = require('../dist/client/AWA/APIs/steam/CommunityEventAPI');

globalThis.__ = (key) => key;
globalThis.log = false;

const temporaryDirectory = (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'awa-repair-test-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
};
const deferred = () => {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
};

test('cookie commits preserve browser changes and reject obsolete concurrent jobs', (t) => {
  const filename = path.join(temporaryDirectory(t), 'config.yml');
  fs.writeFileSync(filename, '# preserve comment\nawaCookie: old\nmanager:\n  secret: keep\n');
  const first = createCookieCommit(filename, 'old');
  const second = createCookieCommit(filename, 'old');
  assert.equal(first('refreshed'), true);
  assert.equal(second('stale'), false);
  assert.equal(first('latest'), true);
  updateYamlFieldsSync(filename, { awaCookie: 'browser' });
  assert.equal(first('obsolete'), false);
  assert.equal(parse(fs.readFileSync(filename, 'utf8')).awaCookie, 'browser');
  assert.match(fs.readFileSync(filename, 'utf8'), /# preserve comment/);
  assert.equal(parse(fs.readFileSync(filename, 'utf8')).manager.secret, 'keep');
});

test('shutdown rejects new dispatches and concurrent callers await one disposal', async () => {
  const coordinator = new JobCoordinator();
  const cleanup = deferred();
  let disposed = 0;
  coordinator.register({ name: 'dailyQuest', run: async () => true, dispose: async () => { disposed++; await cleanup.promise; } });
  const first = coordinator.stopAll();
  const second = coordinator.stopAll();
  assert.equal(first, second);
  assert.throws(() => coordinator.start('dailyQuest'), /shutting down/);
  await Promise.resolve();
  cleanup.resolve();
  await first;
  assert.equal(disposed, 1);
});

test('scheduler discards a restart that was waiting when stop or reload occurred', async () => {
  for (const reload of [false, true]) {
    const stopping = deferred();
    let starts = 0;
    const config = { achievement: { enable: false }, artifacts: [] };
    const scheduler = new Scheduler({ stop: () => stopping.promise, start: () => { starts++; } }, config);
    scheduler.start();
    const pending = scheduler.restart('dailyQuest');
    await new Promise(setImmediate);
    if (reload) scheduler.reload(config);
    else scheduler.stop();
    stopping.resolve();
    await pending;
    assert.equal(starts, 0);
    scheduler.stop();
  }
});

test('simultaneous artifact schedules execute every payload in order', async () => {
  const release = deferred();
  const seen = [];
  const scheduler = new Scheduler({
    stop: async () => {},
    start: async (_name, payload) => { seen.push(payload); if (seen.length === 1) await release.promise; }
  }, { achievement: { enable: false }, artifacts: [] });
  scheduler.start();
  const first = scheduler.restart('artifact', [1, 2, 3]);
  const second = scheduler.restart('artifact', [4, 5, 6]);
  await new Promise(setImmediate);
  assert.deepEqual(seen, [[1, 2, 3]]);
  release.resolve();
  await Promise.all([first, second]);
  assert.deepEqual(seen, [[1, 2, 3], [4, 5, 6]]);
  scheduler.stop();
});

test('AWA rejects external initial targets, redirects and home_site cookies before leaking credentials', async () => {
  let requests = 0;
  const context = new AWAContext({ cookie: 'REMEMBERME=synthetic', transport: { request: async (config) => {
    requests++;
    assert.throws(() => config.beforeRedirect({ protocol: 'https:', hostname: 'attacker.test', path: '/' }), /untrusted/);
    return { status: 302, data: '', headers: { 'set-cookie': ['home_site=attacker.test'] } };
  } } });
  for (const url of ['https://attacker.test/x', '//attacker.test/x', 'http://www.alienwarearena.com/', 'https://alienwarearena.com.attacker.test/']) {
    await assert.rejects(context.request({ url }), /untrusted/);
  }
  assert.equal(requests, 0);
  await assert.rejects(refreshSession(context), /untrusted/);
  assert.equal(requests, 1);
  assert.equal(context.assertTrustedURL('https://na.alienwarearena.com/').hostname, 'na.alienwarearena.com');
});

test('AWA, Twitch and ASF transports inherit the job signal and reject subsequent calls after abort', async () => {
  for (const create of [
    (transport) => new AWAContext({ cookie: 'synthetic=1', transport }),
    (transport) => new TwitchContext({ cookie: 'auth-token=synthetic; unique_id=device', transport }),
    (transport) => new ASFContext({ protocol: 'http', host: 'localhost', port: 1242, botName: 'test', transport })
  ]) {
    const controller = new AbortController();
    let calls = 0;
    const context = create({ request: async (config) => {
      calls++;
      assert.equal(config.signal, controller.signal);
      return { status: 200, data: {}, headers: {} };
    } });
    await runWithRequestSignal(controller.signal, async () => {
      await context.request({ url: 'https://www.alienwarearena.com/' });
      controller.abort();
      await assert.rejects(async () => context.request({ url: 'https://www.alienwarearena.com/' }));
    });
    assert.equal(calls, 1);
  }
});

test('HTTP retry respects zero and cancellation during Retry-After', async () => {
  let attempts = 0;
  const adapter = async (config) => {
    attempts++;
    throw new axios.AxiosError('busy', 'ERR_BAD_RESPONSE', config, {}, { status: 503, headers: { 'retry-after': '10' }, config });
  };
  await assert.rejects(http.get('https://synthetic.test', { adapter, retryTimes: 0 }));
  assert.equal(attempts, 1);
  const controller = new AbortController();
  const pending = http.get('https://synthetic.test', { adapter, signal: controller.signal });
  await new Promise(setImmediate);
  controller.abort();
  await assert.rejects(pending, (error) => axios.isCancel(error));
  assert.equal(attempts, 2);
});

test('Retry-After supports dates without shortening the server delay', () => {
  const now = Date.UTC(2026, 8, 6);
  assert.equal(retryDelayMs(new Date(now + 5000).toUTCString(), 100, now), 5000);
  assert.equal(retryDelayMs('999999999999', 100, now), 999999999999000);
  assert.equal(retryDelayMs('invalid', 100, now), 100);
  assert.equal(retryDelayMs(new Date(now - 5000).toUTCString(), 100, now), 0);
});

test('slow WebSocket clients are terminated before adding to an oversized output queue', () => {
  let sent = 0;
  let terminated = 0;
  const client = { readyState: 1, bufferedAmount: MAX_WS_BUFFER, send: () => sent++, terminate: () => terminated++ };
  globalThis.wsClients.add(client);
  assert.equal(sendWebUiMessage(client, 'message'), false);
  assert.equal(sent, 0);
  assert.equal(terminated, 1);
  assert.equal(globalThis.wsClients.has(client), false);
});

test('log cache bytes, repeated entries and rotated files stay bounded', async (t) => {
  const cwd = process.cwd();
  const webUI = globalThis.webUI;
  t.after(() => { process.chdir(cwd); globalThis.webUI = webUI; });
  const root = temporaryDirectory(t);
  process.chdir(root);
  globalThis.webUI = true;
  globalThis.logs = { type: 'logs' };
  new Logger({ type: 'questInfo', data: { state: 'latest' } });
  for (let index = 0; index < 400; index++) new Logger('x'.repeat(4096));
  assert.deepEqual(globalThis.logs['manager:questInfo'].data, { state: 'latest' });
  assert.ok(Buffer.byteLength(JSON.stringify(globalThis.logs)) < 550 * 1024);
  await flushLogs();
  const filename = getLogFilePath('manager');
  const fd = fs.openSync(filename, 'w');
  fs.ftruncateSync(fd, 10 * 1024 * 1024);
  fs.closeSync(fd);
  new Logger('after rotation');
  await flushLogs();
  assert.ok(fs.statSync(filename).size < 100);
  assert.equal(fs.statSync(filename.replace('.txt', '.1.txt')).size, 10 * 1024 * 1024);
  assert.equal(cleanupExpiredLogs('logs', 1, new Date(2099, 0, 1)), 2);
});

test('update cleanup retains newest rollback, pending stages and unrelated files', (t) => {
  const root = temporaryDirectory(t);
  for (const [index, name] of ['staging-old', 'staging-new', 'staging-pending', 'unrelated'].entries()) {
    const stage = path.join(root, name);
    fs.mkdirSync(stage);
    if (name !== 'staging-pending') {
      const marker = path.join(stage, 'completed.json');
      fs.writeFileSync(marker, '{"status":"success"}');
      fs.utimesSync(marker, 1000 + index, 1000 + index);
    }
  }
  assert.equal(cleanupCompletedUpdates(root), 1);
  assert.deepEqual(fs.readdirSync(root).sort(), ['staging-new', 'staging-pending', 'unrelated']);
});

test('border25 cancellation stops the delay and prevents the next avatar mutation', async () => {
  const controller = new AbortController();
  const service = new AchievementService({ awaCookie: 'test=1', awaHost: 'www.alienwarearena.com' });
  service.awa = { personalization: {} };
  let saves = 0;
  service.awa.personalization.getAvatarItems = async () => ({ found: true, value: {
    userAvatarInfo: { border: 'old' }, ids: Array.from({ length: 25 }, (_, index) => ({ id: String(index) }))
  } });
  service.awa.personalization.saveAvatar = async () => { saves++; controller.abort(); return { ok: true }; };
  await service.border25(controller.signal);
  assert.equal(saves, 1);
});

test('artifact cancellation prevents later slots from being equipped', async () => {
  const controller = new AbortController();
  const service = Object.create(ArtifactService.prototype);
  service.oldArtifacts = [4, 5, 6];
  service.getArtifactsInfo = async () => true;
  let equips = 0;
  service.changeArtifact = async () => { equips++; controller.abort(); return true; };
  assert.equal(await service.start([1, 2, 3], controller.signal), false);
  assert.equal(equips, 1);
});

test('Twitch tracking recovers from an actual wrapped AWA 403', async () => {
  const controller = new AbortController();
  const context = new AWAContext({ cookie: 'test=1', transport: { request: async () => {
    throw Object.assign(new Error('forbidden'), { response: { status: 403 } });
  } } });
  let verifies = 0;
  const awa = { twitch: {
    getAvailableStreams: async () => ({ Hive: ['test'], Nexus: [] }),
    sendTrack: () => context.request({ url: `${context.baseURL}/track` })
  } };
  const twitch = {
    channels: { findTracking: async () => ({ found: true, value: { channelId: '1' } }) },
    session: { verify: async () => { verifies++; controller.abort(); } },
    extensions: { checkLinked: async () => ({ ok: true }) }
  };
  await new TwitchQuestTask({ state: { questInfo: {}, additionalTwitchARP: 0 } }, awa, twitch).run(controller.signal);
  assert.equal(verifies, 1);
});

test('Twitch verification failure does not print Axios credentials to console', async (t) => {
  const messages = [];
  for (const method of ['debug', 'log', 'error']) t.mock.method(console, method, (...args) => messages.push(args));
  const context = new TwitchContext({ cookie: 'auth-token=synthetic-secret; unique_id=test', transport: { request: async () => {
    throw Object.assign(new Error('request failed'), { config: { headers: { Authorization: 'OAuth synthetic-secret' } } });
  } } });
  await assert.rejects(verifySession(context), /Unable to verify/);
  assert.equal(messages.length, 0);
});

test('Steam cancellation during license acquisition never starts playing', async () => {
  const controller = new AbortController();
  let plays = 0;
  const awa = { steam: { getSteamQuests: async () => [] } };
  const asf = { licenses: { add: async () => { controller.abort(); return { ok: true }; } },
    bot: { getOwnedGames: async () => ['1'], playGames: async () => { plays++; return { ok: true }; } } };
  assert.equal(await new SteamQuestTask(awa, asf, () => '1', 0).run(controller.signal), false);
  assert.equal(plays, 0);
});

test('Steam cleanup uses a fresh bounded signal after the job has been cancelled', async () => {
  const controller = new AbortController();
  let stopped = false;
  const context = new ASFContext({ protocol: 'http', host: 'localhost', port: 1242, botName: 'test',
    transport: { request: async (config) => {
      assert.notEqual(config.signal, controller.signal);
      assert.equal(config.signal.aborted, false);
      stopped = true;
      return { status: 200, headers: {}, data: {} };
    } } });
  const awa = { steam: { getSteamQuests: async () => [] } };
  const asf = { licenses: { add: async () => ({ ok: true }) }, bot: {
    getOwnedGames: async () => ['1'], playGames: async () => { controller.abort(); return { ok: true }; },
    stopGames: async () => { await context.request({ url: context.commandURL }); return { ok: true }; }
  } };
  await new SteamQuestTask(awa, asf, () => '1', 0).run(controller.signal);
  assert.equal(stopped, true);
});

test('GET endpoints that claim, complete, synchronize or join disable automatic retries', async () => {
  let requests = 0;
  const context = new AWAContext({ cookie: 'test=1', transport: { request: async (config) => {
    requests++;
    assert.equal(config.retryTimes, 0);
    return { status: 200, data: { success: true }, headers: {} };
  } } });
  await claimQuestAward(context, '1');
  await completeGetStartedItem(context, '/complete');
  await new SteamQuestAPI(context).syncGames(`${context.baseURL}/steam/quests/test`);
  await new SteamQuestAPI(context).startQuest(`${context.baseURL}/steam/quests/test`);
  await new CommunityEventAPI(context).join('test');
  assert.equal(requests, 5);
});
