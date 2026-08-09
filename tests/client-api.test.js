/** Request-level tests for injectable platform transports. */
const assert = require('node:assert/strict');
const test = require('node:test');
const { AWAContext } = require('../dist/client/AWA/AWAContext');
const { getControlCenter } = require('../dist/client/AWA/APIs/quests');
const { TwitchContext } = require('../dist/client/Twitch/TwitchContext');
const { getChannelInfo } = require('../dist/client/Twitch/APIs/channels');
const { ASFContext } = require('../dist/client/Steam/ASFContext');
const { executeCommand } = require('../dist/client/Steam/APIs/commands');

const response = (data, headers = {}) => ({ data, headers, status: 200, statusText: 'OK', config: {} });

test('AWA APIs use injected transport and persist response cookies in context', async () => {
  let request;
  const transport = { request: async (config) => {
    request = config;
    return response('<html>control center</html>', { 'set-cookie': ['session=new-value; Path=/'] });
  } };
  const context = new AWAContext({ cookie: 'session=old-value', host: 'arena.example', userAgent: 'test-agent', transport });
  assert.equal(await getControlCenter(context), '<html>control center</html>');
  assert.equal(request.url, 'https://arena.example/control-center');
  assert.equal(request.headers.cookie, 'session=old-value');
  assert.equal(context.cookie.get('session'), 'new-value');
});

test('Twitch GraphQL API uses injected transport and platform-only endpoint', async () => {
  let request;
  const transport = { request: async (config) => {
    request = config;
    return response([{ data: { user: { id: '42' } } }]);
  } };
  const context = new TwitchContext({ cookie: 'auth-token=token; unique_id=device', userAgent: 'test-agent', transport });
  context.clientId = 'client-id';
  assert.equal(await getChannelInfo(context, 'streamer'), '42');
  assert.equal(request.url, 'https://gql.twitch.tv/gql');
  assert.equal(request.headers['Client-Id'], 'client-id');
});

test('ASF command API uses injected transport and validates the IPC envelope', async () => {
  let request;
  const transport = { request: async (config) => {
    request = config;
    return response({ Success: true, Message: 'OK', Result: 'ready' });
  } };
  const context = new ASFContext({ protocol: 'http', host: '127.0.0.1', port: 1242, botName: 'bot', transport });
  assert.equal(await executeCommand(context, '!status bot'), 'ready');
  assert.equal(request.url, 'http://127.0.0.1:1242/Api/Command');
  assert.deepEqual(JSON.parse(request.data), { Command: '!status bot' });
});
