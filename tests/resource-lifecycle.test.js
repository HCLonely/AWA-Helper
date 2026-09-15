const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { EventEmitter } = require('node:events');
const test = require('node:test');
const { readLogPage } = require('../dist/tools/logging/LogPage');
const { startLogReplay, enqueueReplayMessage } = require('../dist/tools/logging/WebSocketReplay');
const { setLogSecrets, withLogSecrets, formatLogValue, safeErrorMessage } = require('../dist/tools/logging/sanitize');
const { getRunConfiguration, withRunConfiguration, createSessionCommit } = require('../dist/tools/config/RunConfiguration');
const { JobCoordinator } = require('../dist/core/Manager/JobCoordinator');
const { BattlePassTask } = require('../dist/core/DailyQuest/tasks/BattlePassTask');
const { AchievementService } = require('../dist/core/Achievement/AchievementService');
const { flushLogs, LogWriter } = require('../dist/tools/logging/LogWriter');

globalThis.__ = (key) => key;
globalThis.log = false;
const temporary = (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'awa-resource-lifecycle-'));
  t.after(async () => { await flushLogs(); fs.rmSync(root, { recursive: true, force: true }); });
  return root;
};
const deferred = () => {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
};

test('backward log pages reconstruct UTF-8 content without whole-file buffers', async (t) => {
  const file = path.join(temporary(t), 'log.txt');
  const text = '中文😀 log\n'.repeat(20000);
  fs.writeFileSync(file, text);
  const chunks = [];
  let cursor;
  do {
    const page = await readLogPage(file, cursor);
    assert.ok(Buffer.byteLength(page.text) <= 65536);
    assert.ok(!page.text.includes('\ufffd'));
    chunks.unshift(page.text); cursor = page.older;
  } while (cursor);
  assert.equal(chunks.join(''), text);
});

test('32 MiB logs remain fully accessible through bounded online pages', async (t) => {
  const file = path.join(temporary(t), 'large.txt');
  const block = 'x'.repeat(65536);
  const handle = fs.openSync(file, 'w');
  try {
    for (let index = 0; index < 512; index++) fs.writeSync(handle, block);
  } finally { fs.closeSync(handle); }
  let cursor;
  let pages = 0;
  let bytes = 0;
  do {
    const page = await readLogPage(file, cursor);
    assert.equal(page.text, block);
    bytes += Buffer.byteLength(page.text);
    pages++;
    cursor = page.older;
  } while (cursor);
  assert.equal(pages, 512);
  assert.equal(bytes, 32 * 1024 * 1024);
});

test('log page cursor resets on rotation or truncation and rejects malformed input', async (t) => {
  const file = path.join(temporary(t), 'log.txt');
  fs.writeFileSync(file, 'x'.repeat(100000));
  const first = await readLogPage(file);
  fs.renameSync(file, file + '.old');
  fs.writeFileSync(file, 'new file');
  const rotated = await readLogPage(file, first.older);
  assert.equal(rotated.reset, true);
  assert.equal(rotated.text, 'new file');
  fs.writeFileSync(file, 'y'.repeat(100000));
  const next = await readLogPage(file);
  fs.writeFileSync(file, 'short');
  assert.equal((await readLogPage(file, next.older)).reset, true);
  await assert.rejects(readLogPage(file, '../secret'), /Invalid log cursor/);
  const invalid = Buffer.from(JSON.stringify({ identity: 'test', end: -1 })).toString('base64url');
  await assert.rejects(readLogPage(file, invalid), /Invalid log cursor/);
  assert.equal((await readLogPage(file + '.missing')).missing, true);
});

class Socket extends EventEmitter {
  readyState = 1;
  bufferedAmount = 0;
  messages = [];
  callbacks = [];
  send(message, callback) { this.messages.push(message); this.callbacks.push(callback); }
  terminate() { this.readyState = 3; this.emit('close'); }
  drain() { while (this.callbacks.length) this.callbacks.shift()(); }
}

test('chunked replay orders realtime upserts after history and releases on close', () => {
  const socket = new Socket();
  const entries = Array.from({ length: 400 }, (_, id) => ({ id, type: 'log', scope: 'dailyQuest', data: 'x'.repeat(1000) }));
  startLogReplay(socket, entries);
  assert.equal(socket.messages.length, 1);
  const update = JSON.stringify({ id: 0, type: 'log', scope: 'dailyQuest', data: 'latest' });
  assert.equal(enqueueReplayMessage(socket, update, Buffer.byteLength(update)), true);
  socket.drain();
  const history = socket.messages.slice(0, -1).flatMap((message) => Object.values(JSON.parse(message)).filter((value) => typeof value === 'object'));
  assert.deepEqual(history, entries);
  assert.equal(socket.messages.at(-1), update);
  assert.ok(socket.messages.slice(0, -1).every((message) => Buffer.byteLength(message) <= 65536));
  socket.terminate();
  assert.equal(enqueueReplayMessage(socket, update, update.length), undefined);
});

test('a stalled replay has a finite queue and tolerates a late send callback', () => {
  const socket = new Socket();
  startLogReplay(socket, [{ id: 1, type: 'log', scope: 'manager', data: 'old' }]);
  assert.equal(enqueueReplayMessage(socket, 'x'.repeat(1024 * 1024), 1024 * 1024), false);
  assert.equal(socket.readyState, 3);
  assert.doesNotThrow(() => socket.drain());
});

test('retired configuration secrets survive in old tasks and delayed errors, not the current default', async () => {
  setLogSecrets({ password: 'old-credential' });
  const gate = deferred();
  const old = withLogSecrets({ password: 'task-credential' }, async () => {
    await gate.promise;
    assert.equal(formatLogValue('old-credential task-credential'), '******** ********');
    const error = new Error('old-credential task-credential');
    error.config = { url: 'https://example.test/task-credential' };
    throw error;
  });
  setLogSecrets({ password: 'new-credential' });
  assert.equal(formatLogValue('old-credential new-credential'), 'old-credential ********');
  gate.resolve();
  let failure;
  try { await old; } catch (error) { failure = error; }
  assert.equal(safeErrorMessage(failure), '******** ********');
  assert.ok(!formatLogValue(failure).includes('task-credential'));
});

test('many configuration rotations do not accumulate a process-wide secret history', async () => {
  globalThis.secrets = [];
  for (let index = 0; index < 500; index++) {
    setLogSecrets({ password: `credential-${index}` });
    await withLogSecrets({ password: `run-${index}-secret` }, async () => {
      assert.equal(formatLogValue(`run-${index}-secret`), '********');
    });
  }
  assert.deepEqual(globalThis.secrets, []);
  assert.equal(formatLogValue('credential-499'), '********');
  assert.equal(formatLogValue('credential-0'), 'credential-0');
});

test('configuration snapshots isolate active runs while new jobs observe file changes', async (t) => {
  const file = path.join(temporary(t), 'config.yml');
  const write = (cookie) => fs.writeFileSync(file, `awaCookie: ${cookie}\nmanager:\n  secret: synthetic-manager-secret\n`);
  write('old-cookie');
  const gate = deferred();
  const old = withRunConfiguration(file, async () => {
    assert.equal(getRunConfiguration().raw.awaCookie, 'old-cookie');
    await gate.promise;
    assert.equal(getRunConfiguration(file).raw.awaCookie, 'old-cookie');
  });
  write('new-cookie');
  await withRunConfiguration(file, async () => { assert.equal(getRunConfiguration().raw.awaCookie, 'new-cookie'); });
  gate.resolve(); await old;
  const snapshot = getRunConfiguration(file); snapshot.raw.awaCookie = 'mutated';
  assert.equal(getRunConfiguration(file).raw.awaCookie, 'new-cookie');
});

test('shared session persistence rejects an obsolete job after a browser replacement', (t) => {
  const file = path.join(temporary(t), 'config.yml');
  fs.writeFileSync(file, 'awaCookie: old\nmanager:\n  secret: synthetic-manager-secret\n');
  const commit = createSessionCommit(file, 'old');
  assert.equal(commit('refreshed'), true);
  assert.equal(getRunConfiguration(file).raw.awaCookie, 'refreshed');
  fs.writeFileSync(file, 'awaCookie: browser\nmanager:\n  secret: synthetic-manager-secret\n');
  assert.equal(commit('obsolete'), false);
  assert.equal(getRunConfiguration(file).raw.awaCookie, 'browser');
});

test('coordinator exposes partial and skipped outcomes while retaining boolean job support', async () => {
  const coordinator = new JobCoordinator();
  coordinator.register({ name: 'dailyQuest', run: async () => ({ status: 'partial', message: 'one reward failed' }) });
  coordinator.register({ name: 'achievement', run: async () => ({ status: 'skipped' }) });
  coordinator.register({ name: 'artifact', run: async () => true });
  assert.equal((await coordinator.start('dailyQuest')).success, false);
  assert.equal(coordinator.states.get('dailyQuest').status, 'partial');
  assert.equal((await coordinator.start('achievement')).success, true);
  assert.equal(coordinator.states.get('achievement').status, 'skipped');
  assert.equal((await coordinator.start('artifact')).success, true);
  await coordinator.stopAll(); await flushLogs();
});

test('Battle Pass detailed result distinguishes rejected rewards from completion', async () => {
  const reward = { index: 0, milestoneId: 1, name: 'Reward', state: 'unlockable', claim: { path: '/claim', csrfToken: 'test' } };
  const runtime = { state: { battlePassUrl: 'https://example.test/pass' }, awa: { battlePass: {
    getPage: async () => ({ status: 'active', claimedCount: 0, rewardTotal: 1, rewards: [reward] }),
    claim: async () => ({ ok: false, reason: 'rejected' })
  } } };
  assert.equal((await BattlePassTask.runDetailed(runtime)).status, 'partial');
});

test('achievement lookup failure is not reported as a successful action', async () => {
  const service = new AchievementService({ awaCookie: 'synthetic=1' });
  service.awa.personalization.getAvatarItems = async () => ({ found: false });
  assert.deepEqual(await service.border25(), { status: 'failed' });
});

test('expired achievement tracking authorization backs off instead of spinning discovery', async () => {
  const service = Object.create(AchievementService.prototype);
  service.watchTwitchStatus = { running: true, type: new Set(['hive']) };
  service.awa = { twitch: { sendTrack: async () => { throw new Error('Expired token must not be sent'); } } };
  const jwt = `header.${Buffer.from('{"exp":1}').toString('base64url')}.signature`;
  assert.equal(await service.trackTwitchChannel({ channelId: '42', jwt }), 'retry');
});

test('disk-full errors release the writer budget and later batches recover', async (t) => {
  const file = path.join(temporary(t), 'log.txt');
  const original = fs.promises.open;
  let fail = true;
  t.mock.method(fs.promises, 'open', async (...args) => {
    const handle = await original(...args);
    if (!fail) return handle;
    fail = false;
    return { close: () => handle.close(), writev: async () => { throw Object.assign(new Error('Synthetic disk full'), { code: 'ENOSPC' }); } };
  });
  const writer = new LogWriter();
  writer.enqueue(file, Buffer.from('failed'));
  assert.equal(await writer.flush(), true);
  assert.equal(writer.stats.failed, 1);
  assert.equal(writer.pendingBytes, 0);
  writer.enqueue(file, Buffer.from('recovered'));
  await writer.flush();
  assert.equal(fs.readFileSync(file, 'utf8'), 'recovered');
});

test('rotation with an open download handle preserves its original file contents', async (t) => {
  const file = path.join(temporary(t), 'log.txt');
  fs.writeFileSync(file, 'x'.repeat(32));
  const download = await fs.promises.open(file, 'r');
  const writer = new LogWriter(1024, 32);
  try {
    writer.enqueue(file, Buffer.from('new'));
    await writer.flush();
    assert.equal(await download.readFile('utf8'), 'x'.repeat(32));
    assert.equal(writer.stats.failed, 0);
    assert.equal(fs.readFileSync(file, 'utf8'), 'new');
  } finally { await download.close(); }
});
