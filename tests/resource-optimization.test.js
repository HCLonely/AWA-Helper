/**
 * @file tests/resource-optimization.test.js
 * @description 验证资源使用上限与优化行为。
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const {
  getEventListeners
} = require('node:events');
const {
  LogCache
} = require('../dist/tools/logging/LogCache');
const {
  LogWriter, flushLogs, writeFileLog
} = require('../dist/tools/logging/LogWriter');
const {
  SharedRead
} = require('../dist/tools/http/SharedRead');
const {
  maintainLogs
} = require('../dist/tools/logging/retention');
const {
  cleanupCompletedUpdatesAsync
} = require('../dist/tools/update/retention');
const {
  trackingExpiry
} = require('../dist/core/DailyQuest/tasks/TwitchQuestTask');
const {
  getControlCenter
} = require('../dist/client/AWA/APIs/quests/getControlCenter');
const {
  getAvailableStreams
} = require('../dist/client/AWA/APIs/twitch/getAvailableStreams');
const {
  runWithRequestSignal
} = require('../dist/tools/http/RequestContext');
const {
  AWAContext
} = require('../dist/client/AWA/AWAContext');
const {
  TwitchContext
} = require('../dist/client/Twitch/TwitchContext');
const {
  getChannelInfo
} = require('../dist/client/Twitch/APIs/channels/getChannelInfo');
const {
  subscribeWebUiScope, acceptsWebUiScope
} = require('../dist/tools/logging/WebSocketLimits');
const {
  http
} = require('../dist/tools/http/client');
const axios = require('axios');

const temporary = (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'awa-resource-'));
  t.after(() => fs.rmSync(root, {
    recursive: true,
    force: true
  }));
  return root;
};
const deferred = () => {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return {
    promise,
    resolve
  };
};

test('log cache updates preserve FIFO order, scope quotas and exact encoded accounting', () => {
  const entries = {
    type: 'logs'
  };
  const cache = new LogCache(entries, 700, 2);
  const put = (id, data, scope = 'manager', type = 'log') => {
    const entry = {
      id,
      data,
      scope,
      type
    };
    cache.put(entry, JSON.stringify(entry));
    const bytes = Object.entries(entries).filter(([key]) => key !== 'type')
      .reduce((sum, [, value]) => sum + Buffer.byteLength(JSON.stringify(value)), 0);
    assert.equal(cache.byteLength, bytes);
    assert.ok(bytes <= 700);
  };
  put(0, {
    latest: true
  }, 'manager', 'questInfo');
  put(1, 'first'); put(2, 'second'); put(1, 'updated'); put(3, 'third');
  assert.equal(entries['manager:1'], undefined);
  assert.equal(entries['manager:2'].data, 'second');
  for (let id = 4; id < 30; id++) put(id, '中文'.repeat(25), 'achievement');
  assert.deepEqual(entries['manager:questInfo'].data, {
    latest: true
  });
});

test('writer batches records, rotates at bytes and detects external truncation between batches', async (t) => {
  const root = temporary(t);
  const file = path.join(root, 'Manager-2026-09-14.txt');
  const writer = new LogWriter(1024, 12);
  writer.enqueue(file, Buffer.from('first\n'));
  writer.enqueue(file, Buffer.from('second\n'));
  assert.equal(await writer.flush(), true);
  assert.equal(fs.readFileSync(file.replace('.txt', '.1.txt'), 'utf8'), 'first\n');
  assert.equal(fs.readFileSync(file, 'utf8'), 'second\n');
  fs.writeFileSync(file, '');
  writer.enqueue(file, Buffer.from('new\n'));
  assert.equal(await writer.flush(), true);
  assert.equal(fs.readFileSync(file, 'utf8'), 'new\n');
  assert.equal(writer.pendingBytes, 0);
});

test('slow disk counts the active batch, bounds overflow and flush deadline without losing accepted order', async (t) => {
  const root = temporary(t);
  const gate = deferred();
  const original = fs.promises.open;
  t.mock.method(fs.promises, 'open', async (...args) => { await gate.promise; return original(...args); });
  const writer = new LogWriter(12, 100);
  const file = path.join(root, 'log.txt');
  writer.enqueue(file, Buffer.from('first\n'));
  const flushing = writer.flush(10);
  writer.enqueue(file, Buffer.from('next\n'));
  assert.equal(writer.enqueue(file, Buffer.from('overflow')), false);
  assert.equal(writer.pendingBytes, 11);
  assert.equal(await flushing, false);
  gate.resolve();
  assert.equal(await writer.flush(), true);
  assert.equal(fs.readFileSync(file, 'utf8'), 'first\nnext\n');
  assert.equal(writer.stats.dropped, 1);
  assert.equal(writer.stats.peakBytes, 11);
});

test('writer failure releases budget and subsequent files still flush', async (t) => {
  const root = temporary(t);
  const blocked = path.join(root, 'blocked');
  fs.writeFileSync(blocked, 'not a directory');
  const writer = new LogWriter();
  writer.enqueue(path.join(blocked, 'log.txt'), Buffer.from('failed'));
  writer.enqueue(path.join(root, 'good.txt'), Buffer.from('accepted'));
  assert.equal(await writer.flush(), true);
  assert.equal(writer.stats.failed, 1);
  assert.equal(writer.pendingBytes, 0);
  assert.equal(fs.readFileSync(path.join(root, 'good.txt'), 'utf8'), 'accepted');
});

test('file logging sanitizes before queuing and truncates on a UTF-8 boundary', async (t) => {
  const root = temporary(t);
  const cwd = process.cwd();
  const secrets = globalThis.secrets;
  process.chdir(root);
  globalThis.secrets = ['synthetic-secret'];
  try {
    writeFileLog('manager', 'synthetic-secret' + '中文😀'.repeat(30000));
    globalThis.secrets = [];
    await flushLogs();
    const file = path.join(root, 'logs', fs.readdirSync(path.join(root, 'logs'))[0]);
    const contents = fs.readFileSync(file);
    assert.ok(contents.length <= 64 * 1024);
    assert.ok(!contents.toString().includes('synthetic-secret'));
    assert.ok(!contents.toString().includes('\ufffd'));
    assert.equal(contents.at(-1), 10);
  } finally {
    await flushLogs();
    process.chdir(cwd);
    globalThis.secrets = secrets;
  }
});

test('shared read detaches cancellation and drops completed values', async () => {
  const read = new SharedRead();
  const gate = deferred();
  const controller = new AbortController();
  let calls = 0;
  let transportSignal;
  const fetch = async (signal) => { calls++; transportSignal = signal; return gate.promise; };
  const first = read.get(fetch, controller.signal);
  const second = read.get(fetch);
  await Promise.resolve();
  controller.abort();
  await assert.rejects(first, /cancelled/);
  assert.equal(transportSignal.aborted, false);
  gate.resolve('fresh');
  assert.equal(await second, 'fresh');
  assert.equal(calls, 1);
  assert.equal(getEventListeners(controller.signal, 'abort').length, 0);
  await read.get(fetch);
  assert.equal(calls, 2);
});

test('all cancelled readers release the slot even if the old transport ignores abort', async () => {
  const read = new SharedRead();
  const controller = new AbortController();
  const gate = deferred();
  let signal;
  const pending = read.get(async (value) => { signal = value; return gate.promise; }, controller.signal);
  await Promise.resolve();
  controller.abort();
  await assert.rejects(pending);
  assert.equal(signal.aborted, true);
  assert.equal(await read.get(async () => 'new'), 'new');
  gate.resolve('obsolete');
});

test('Control Center and stream discovery share a read without sharing caller cancellation', async () => {
  const gate = deferred();
  let calls = 0;
  let signal;
  const context = new AWAContext({
    cookie: 'synthetic=1',
    transport: {
      request: async (options) => {
        calls++; signal = options.signal;
        await gate.promise;
        return {
          data: '<html></html>',
          headers: {},
          status: 200
        };
      }
    }
  });
  const controller = new AbortController();
  const state = runWithRequestSignal(controller.signal, () => getControlCenter(context));
  const streams = getAvailableStreams(context);
  await Promise.resolve();
  controller.abort();
  await assert.rejects(state);
  assert.equal(signal.aborted, false);
  gate.resolve();
  await streams;
  assert.equal(calls, 1);
  await getControlCenter(context);
  assert.equal(calls, 2);
});

test('a completed GET mutation prevents a fresh refresh from joining an older page read', async () => {
  const old = deferred();
  let pages = 0;
  const context = new AWAContext({
    cookie: 'synthetic=1',
    transport: {
      request: async (options) => {
        if (options.url.endsWith('/control-center')) {
          pages++;
          if (pages === 1) await old.promise;
          return {
            data: String(pages),
            headers: {},
            status: 200
          };
        }
        return {
          data: 'claimed',
          headers: {},
          status: 200
        };
      }
    }
  });
  const first = getControlCenter(context);
  await Promise.resolve();
  await context.request({
    url: `${context.baseURL}/claim`,
    method: 'GET',
    retryTimes: 0
  });
  assert.equal(await getControlCenter(context), '2');
  old.resolve();
  await first;
  assert.equal(pages, 2);
});

test('tracking reuse respects expiry and a conservative maximum lifetime', () => {
  const now = 1000000;
  const jwt = (exp) => `header.${Buffer.from(JSON.stringify({
    exp
  })).toString('base64url')}.signature`;
  assert.equal(trackingExpiry(jwt(9999999), now), now + 300000);
  assert.equal(trackingExpiry(jwt(1060), now), now + 30000);
  assert.equal(trackingExpiry(jwt(900), now), now);
  assert.equal(trackingExpiry('opaque', now), now + 60000);
});

test('channel ID cache is bounded, context-local, and still respects cancellation', async () => {
  let calls = 0;
  const context = new TwitchContext({
    cookie: 'auth-token=synthetic',
    transport: {
      request: async () => {
        calls++;
        return {
          data: [{
            data: {
              user: {
                id: '42'
              }
            }
          }],
          headers: {},
          status: 200
        };
      }
    }
  });
  context.clientId = 'test';
  await getChannelInfo(context, 'first');
  await getChannelInfo(context, 'first');
  assert.equal(calls, 1);
  for (let index = 0; index < 128; index++) await getChannelInfo(context, `channel-${index}`);
  await getChannelInfo(context, 'first');
  assert.equal(calls, 130);
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(runWithRequestSignal(controller.signal, () => getChannelInfo(context, 'first')));
  assert.equal(calls, 130);
});

test('scope subscriptions filter new clients and preserve legacy full subscriptions', () => {
  const client = {};
  assert.equal(acceptsWebUiScope(client, 'manager'), true);
  subscribeWebUiScope(client, 'dailyQuest');
  assert.equal(acceptsWebUiScope(client, 'manager'), false);
  assert.equal(acceptsWebUiScope(client, 'dailyQuest'), true);
});

test('long Retry-After is returned to the caller instead of retried prematurely', async () => {
  let attempts = 0;
  await assert.rejects(http.get('https://synthetic.test', {
    adapter: async (config) => {
      attempts++;
      throw new axios.AxiosError('busy', 'ERR_BAD_RESPONSE', config, {}, {
        status: 429,
        headers: {
          'retry-after': '3600'
        },
        config
      });
    }
  }));
  assert.equal(attempts, 1);
});

test('maintenance enforces capacity only against eligible logs and preserves active files', async (t) => {
  const root = temporary(t);
  const names = ['Manager-2026-09-01.txt', 'DailyQuest-2026-09-02.txt', 'Artifact-2026-09-14.txt', 'unrelated.txt'];
  for (const name of names) fs.writeFileSync(path.join(root, name), 'x'.repeat(10));
  const result = await maintainLogs(root, 0, 10, (file) => file.endsWith(names[1]), new Date(2026, 8, 14));
  assert.equal(result.removed, 1);
  assert.equal(result.remainingBytes, 20);
  assert.deepEqual(fs.readdirSync(root).sort(), names.slice(1).sort());
});

test('asynchronous update maintenance keeps pending stages and newest successful rollback', async (t) => {
  const root = temporary(t);
  for (const [index, name] of ['staging-old', 'staging-new', 'staging-pending'].entries()) {
    const target = path.join(root, name);
    fs.mkdirSync(target);
    if (name.endsWith('pending')) continue;
    const marker = path.join(target, 'completed.json');
    fs.writeFileSync(marker, '{"status":"success"}');
    fs.utimesSync(marker, 1000 + index, 1000 + index);
  }
  assert.equal(await cleanupCompletedUpdatesAsync(root), 1);
  assert.deepEqual(fs.readdirSync(root).sort(), ['staging-new', 'staging-pending']);
});
