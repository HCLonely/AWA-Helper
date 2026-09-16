/**
 * @file tests/resource-delivery.test.js
 * @description 验证构建资源交付与页面依赖。
 */
const assert = require('node:assert/strict');
const {
  EventEmitter
} = require('node:events');
const test = require('node:test');
const {
  startLogReplay, enqueueReplayMessage, REPLAY_SEND_TIMEOUT_MS
} = require('../dist/tools/logging/WebSocketReplay');

class StalledSocket extends EventEmitter {
  readyState = 1;
  bufferedAmount = 0;
  callbacks = [];
  send(_message, callback) { this.callbacks.push(callback); }
  terminate() { this.readyState = 3; this.emit('close'); }
}

test('a stalled send expires even if no additional log fills the queue', (t) => {
  t.mock.timers.enable({
    apis: ['setTimeout']
  });
  const socket = new StalledSocket();
  startLogReplay(socket, []);
  t.mock.timers.tick(REPLAY_SEND_TIMEOUT_MS - 1);
  assert.equal(socket.readyState, 1);
  t.mock.timers.tick(1);
  assert.equal(socket.readyState, 3);
  assert.equal(enqueueReplayMessage(socket, '{}', 2), undefined);
  assert.doesNotThrow(() => socket.callbacks[0]());
});

test('successful and closed replay sends clear their deadlines', (t) => {
  t.mock.timers.enable({
    apis: ['setTimeout']
  });
  const socket = new StalledSocket();
  startLogReplay(socket, []);
  socket.callbacks.shift()();
  t.mock.timers.tick(REPLAY_SEND_TIMEOUT_MS * 2);
  assert.equal(socket.readyState, 1);
  enqueueReplayMessage(socket, '{}', 2);
  socket.terminate();
  let terminatedAgain = false;
  socket.terminate = () => { terminatedAgain = true; };
  t.mock.timers.tick(REPLAY_SEND_TIMEOUT_MS * 2);
  assert.equal(terminatedAgain, false);
});
