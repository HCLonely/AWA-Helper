/** Request-level tests for injectable platform transports. */
const assert = require('node:assert/strict');
const test = require('node:test');
const { AWAContext } = require('../dist/client/AWA/AWAContext');
const { getControlCenter } = require('../dist/client/AWA/APIs/quests');
const { TwitchContext } = require('../dist/client/Twitch/TwitchContext');
const { getChannelInfo } = require('../dist/client/Twitch/APIs/channels');
const { ASFContext } = require('../dist/client/Steam/ASFContext');
const { executeCommand } = require('../dist/client/Steam/APIs/commands');
const { playGames } = require('../dist/client/Steam/APIs/bot');
const { BattlePassAPI } = require('../dist/client/AWA/APIs/battlePass');

const response = (data, headers = {}) => ({ data, headers, status: 200, statusText: 'OK', config: {} });

test('platform HTTP request logging is disabled by default and requires explicit opt-in', () => {
  const transport = { request: async () => response({}) };
  assert.equal(new AWAContext({ cookie: '', transport }).logRequests, false);
  assert.equal(new TwitchContext({ cookie: '', transport }).logRequests, false);
  assert.equal(new ASFContext({ protocol: 'http', host: 'localhost', port: 1242, botName: 'bot', transport }).logRequests, false);
  assert.equal(new AWAContext({ cookie: '', transport, logRequests: true }).logRequests, true);
  assert.equal(new TwitchContext({ cookie: '', transport, logRequests: true }).logRequests, true);
  assert.equal(new ASFContext({ protocol: 'http', host: 'localhost', port: 1242, botName: 'bot', transport, logRequests: true }).logRequests, true);
});

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
  assert.deepEqual(await getChannelInfo(context, 'streamer'), { found: true, value: '42' });
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

test('ASF applies the configured proxy agent for its target protocol', async () => {
  const requests = [];
  const transport = { request: async (config) => {
    requests.push(config);
    return response({ Success: true, Message: 'OK', Result: 'ready' });
  } };
  const proxy = { enable: ['asf'], protocol: 'http', host: '127.0.0.1', port: 8080 };

  const httpContext = new ASFContext({ protocol: 'http', host: 'asf.local', port: 1242, botName: 'bot', proxy, transport });
  await executeCommand(httpContext, '!status bot');
  assert.ok(requests[0].httpAgent);
  assert.equal(requests[0].httpsAgent, undefined);

  const httpsContext = new ASFContext({ protocol: 'https', host: 'asf.local', port: 1242, botName: 'bot', proxy, transport });
  await executeCommand(httpsContext, '!status bot');
  assert.ok(requests[1].httpsAgent);
  assert.equal(requests[1].httpAgent, undefined);
});

test('remote operations return discriminated business results', async () => {
  let requested = false;
  const transport = { request: async () => {
    requested = true;
    return response({ Success: true, Message: 'OK', Result: 'ready' });
  } };
  const context = new ASFContext({ protocol: 'http', host: '127.0.0.1', port: 1242, botName: 'bot', transport });
  assert.deepEqual(await playGames(context, []), { ok: false, state: 'no-games' });
  assert.equal(requested, false);
});

test('Battle Pass claim uses multipart form data and validates milestone response', async () => {
  let request;
  const transport = { request: async (config) => {
    request = config;
    return response({ success: true, milestoneId: 3, userMilestoneId: 99 });
  } };
  const context = new AWAContext({ cookie: 'session=value', host: 'arena.example', transport });
  const api = new BattlePassAPI(context);
  const result = await api.claim('https://arena.example/control-center/battle-pass/1', {
    index: 0,
    milestoneId: 3,
    name: 'Reward',
    state: 'unlockable',
    claim: { path: '/battle-pass/claim/99', csrfToken: 'token-value' }
  });

  assert.equal(result.ok, true);
  assert.equal(request.url, 'https://arena.example/battle-pass/claim/99');
  assert.match(request.headers['content-type'], /^multipart\/form-data; boundary=/);
  assert.match(request.data.getBuffer().toString(), /name="_csrf_token"[\s\S]*token-value/);
});

test('Battle Pass claim rejects cross-origin paths and mismatched milestones', async () => {
  let requests = 0;
  const transport = { request: async () => {
    requests += 1;
    return response({ success: true, milestoneId: 4, userMilestoneId: 99 });
  } };
  const api = new BattlePassAPI(new AWAContext({ cookie: '', host: 'arena.example', transport }));
  const reward = {
    index: 0, milestoneId: 3, name: 'Reward', state: 'unlockable',
    claim: { path: 'https://evil.example/claim', csrfToken: 'token' }
  };
  assert.deepEqual(await api.claim('https://arena.example/control-center/battle-pass/1', reward), { ok: false, reason: 'invalid-request' });
  assert.equal(requests, 0);
  reward.claim.path = '/battle-pass/claim/99';
  assert.deepEqual(await api.claim('https://arena.example/control-center/battle-pass/1', reward), { ok: false, reason: 'milestone-mismatch' });
});
