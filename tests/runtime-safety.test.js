const assert = require('node:assert/strict');
const { getEventListeners } = require('node:events');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { cleanupExpiredLogs } = require('../dist/tools/logging/retention');
const { formatLogValue, setLogSecrets } = require('../dist/tools/logging/sanitize');
const { requestHealthEndpoint } = require('../dist/tools/process/healthcheck');
const { Logger, sleep } = require('../dist/tools');
const { decodeManagerWebSocketSecret } = require('../dist/server/websocket/authenticate');

test('log formatting removes configured secrets and Axios request headers', () => {
  const secret = 'very-sensitive-cookie-value';
  setLogSecrets({ awaCookie: `REMEMBERME=${secret}` });
  const error = new Error(`request failed for ${secret}`);
  error.config = { method: 'get', url: 'https://example.test', headers: { cookie: secret } };
  error.response = { status: 401 };
  const output = formatLogValue(error);
  assert.equal(output.includes(secret), false);
  assert.equal(output.includes('headers'), false);
  assert.match(output, /401/);
});

test('awaHost remains visible in logs while credentials stay redacted', () => {
  const awaHost = 'example.awa-host.test';
  const cookie = 'REMEMBERME=host-visibility-secret';
  setLogSecrets({ awaHost, awaCookie: cookie });
  const output = formatLogValue({ awaHost, awaCookie: cookie });
  assert.match(output, new RegExp(awaHost.replaceAll('.', '\\.')));
  assert.equal(output.includes(cookie), false);
});

test('WebUI logs preserve object details instead of coercing them to object Object', (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'awa-helper-webui-log-'));
  const originalDirectory = process.cwd();
  const originalWebUI = globalThis.webUI;
  const originalLog = globalThis.log;
  const messages = [];
  t.after(() => {
    process.chdir(originalDirectory);
    globalThis.webUI = originalWebUI;
    globalThis.log = originalLog;
    globalThis.wsClients.clear();
    fs.rmSync(directory, { recursive: true, force: true });
  });
  process.chdir(directory);
  fs.mkdirSync('logs');
  globalThis.webUI = true;
  globalThis.log = false;
  globalThis.wsClients.add({
    readyState: 1,
    send(message) {
      messages.push(JSON.parse(message));
    }
  });

  new Logger({ status: 500, data: { message: 'push denied' } });

  assert.equal(messages.length, 1);
  assert.doesNotMatch(messages[0].data, /\[object Object\]/);
  assert.match(messages[0].data, /500/);
  assert.match(messages[0].data, /push denied/);
});

test('sleep removes its abort listener after normal completion', async () => {
  const controller = new AbortController();
  await sleep(0.001, controller.signal);
  assert.equal(getEventListeners(controller.signal, 'abort').length, 0);
});

test('log retention removes old logs even when there are only a few files', (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'awa-helper-logs-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  fs.writeFileSync(path.join(directory, '2020-01-01.txt'), 'old');
  fs.writeFileSync(path.join(directory, 'Manager-2099-01-01.txt'), 'new');
  fs.writeFileSync(path.join(directory, 'notes.txt'), 'keep');
  assert.equal(cleanupExpiredLogs(directory, 30, new Date(2026, 7, 7)), 1);
  assert.equal(fs.existsSync(path.join(directory, '2020-01-01.txt')), false);
  assert.equal(fs.existsSync(path.join(directory, 'notes.txt')), true);
});

test('health endpoint probe reflects the actual server response', async () => {
  const server = http.createServer((req, res) => {
    res.statusCode = req.url === '/health/live' ? 200 : 404;
    res.end();
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  assert.equal(typeof address, 'object');
  assert.equal(await requestHealthEndpoint(address.port, false), true);
  await new Promise((resolve) => server.close(resolve));
  assert.equal(await requestHealthEndpoint(address.port, false), false);
});

test('Manager WebSocket protocol carries an authenticated secret', () => {
  const secret = 'manager-secret-至少十六字符';
  const encoded = Buffer.from(secret).toString('base64url');
  assert.equal(decodeManagerWebSocketSecret(`awa-manager, ${encoded}`), secret);
  assert.equal(decodeManagerWebSocketSecret(`other, ${encoded}`), '');
  assert.equal(decodeManagerWebSocketSecret(`awa-manager, ${'a'.repeat(8193)}`), '');
});
