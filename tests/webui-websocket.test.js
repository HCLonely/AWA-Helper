/** Behavioral tests for persistent WebUI WebSocket reconnection. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const source = fs.readFileSync(
  path.join(__dirname, '../src/webUI/static/js/pages/dailyQuest.js'),
  'utf8'
);
const page = fs.readFileSync(path.join(__dirname, '../src/webUI/dailyQuest.html'), 'utf8');

const createHarness = () => {
  const sockets = [];
  const timers = new Map();
  let nextTimerId = 1;

  class FakeWebSocket {
    constructor(url, protocols) {
      this.url = url;
      this.protocols = protocols;
      sockets.push(this);
    }
  }

  const element = {
    append() { return this; },
    attr() { return this; },
    css() { return this; },
    empty() { return this; },
    eq() { return this; },
    find() { return this; },
    hide() { return this; },
    html() { return this; },
    show() { return this; },
    text() { return this; }
  };
  const storage = { getItem: () => null };
  const window = {
    location: {
      protocol: 'http:',
      host: 'localhost:1234',
      hostname: 'localhost'
    },
    setTimeout(callback, delay) {
      const id = nextTimerId++;
      timers.set(id, { callback, delay });
      return id;
    }
  };
  const context = {
    $: () => element,
    dom: () => element,
    I18n: {},
    WebSocket: FakeWebSocket,
    btoa: (value) => Buffer.from(value, 'binary').toString('base64'),
    console: { log() {} },
    dayjs: () => ({ format: () => 'now' }),
    lang: 'en',
    localStorage: storage,
    sessionStorage: storage,
    TextEncoder,
    window
  };
  vm.runInNewContext(source, context);

  const runNextTimer = () => {
    const [id, timer] = timers.entries().next().value;
    timers.delete(id);
    timer.callback();
    return timer.delay;
  };

  return { runNextTimer, sockets, timers };
};

test('WebUI keeps reconnecting after repeated WebSocket disconnects', () => {
  const harness = createHarness();
  assert.equal(harness.sockets.length, 1);

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const socket = harness.sockets.at(-1);
    socket.onclose();
    assert.equal(harness.timers.size, 1);
    const delay = harness.runNextTimer();
    assert.ok(delay >= 1000 && delay <= 30000);
  }

  assert.equal(harness.sockets.length, 9);
});

test('WebSocket error and close events schedule only one reconnect', () => {
  const harness = createHarness();
  const [socket] = harness.sockets;

  socket.onerror();
  socket.onclose();

  assert.equal(harness.timers.size, 1);
});

test('DailyQuest WebUI renders Battle Pass status and claimed reward progress', () => {
  assert.match(page, /id="battle-pass"/);
  assert.match(source, /#battle-pass/);
  assert.match(source, /battlePassStatus_completed/);
});
