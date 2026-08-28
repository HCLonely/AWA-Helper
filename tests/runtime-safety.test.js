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
const chalk = require('chalk');
const { configureWebUiColors, Logger, sleep } = require('../dist/tools');
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

test('WebUI logs preserve Chalk colors when stdout has no color support', (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'awa-helper-webui-color-'));
  const originalDirectory = process.cwd();
  const originalWebUI = globalThis.webUI;
  const originalLog = globalThis.log;
  const originalColorLevel = chalk.level;
  const messages = [];
  t.after(() => {
    process.chdir(originalDirectory);
    globalThis.webUI = originalWebUI;
    globalThis.log = originalLog;
    globalThis.wsClients.clear();
    chalk.level = originalColorLevel;
    fs.rmSync(directory, { recursive: true, force: true });
  });
  process.chdir(directory);
  fs.mkdirSync('logs');
  globalThis.webUI = true;
  globalThis.log = false;
  chalk.level = 0;
  configureWebUiColors(true);
  globalThis.wsClients.add({
    readyState: 1,
    send(message) {
      messages.push(JSON.parse(message));
    }
  });

  new Logger(`${chalk.gray('[time] ')}status: ${chalk.green('success')}`);

  assert.equal(messages.length, 1);
  assert.match(messages[0].data, /<font class="gray">\[time\] <\/font>/);
  assert.match(messages[0].data, /<font class="green">success<\/font>/);
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
    res.statusCode = req.url === '/api/health/live' ? 200 : 404;
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

test('Unified WebSocket always requires the Manager secret', () => {
  const source = fs.readFileSync(path.resolve(__dirname, '../src/server/UnifiedServer.ts'), 'utf8');
  assert.match(source, /if \(!isValidSecret\(candidate\)\)/);
  assert.doesNotMatch(source, /raw\.webUI\?\.local === false && !isValidSecret\(candidate\)/);
});

test('Unified server ignores local binding inside the container runtime', () => {
  const source = fs.readFileSync(path.resolve(__dirname, '../src/server/UnifiedServer.ts'), 'utf8');
  assert.match(source, /getManagerListenHost\(raw\.webUI\?\.local, process\.env\.AWA_HELPER_CONTAINER === 'true'\)/);
});

test('short Manager secrets warn without failing configuration validation', () => {
  const schema = fs.readFileSync(path.resolve(__dirname, '../src/tools/config/ConfigSchema.ts'), 'utf8');
  const runtime = fs.readFileSync(path.resolve(__dirname, '../src/core/Manager/ManagerRuntime.ts'), 'utf8');
  assert.doesNotMatch(schema, /manager\.secret must contain at least 16 characters/);
  assert.match(runtime, /this\.loaded\.manager\.secret\.length < 16/);
  assert.match(runtime, /managerWeakSecretWarning/);
});

test('DailyQuest always clears its process timeout', () => {
  const source = fs.readFileSync(path.resolve(__dirname, '../src/core/DailyQuest/DailyQuestRunner.ts'), 'utf8');
  assert.match(source, /finally \{[\s\S]*clearTimeout\(timeoutHandle\)/);
});

test('DailyQuest terminal notifications are mutually exclusive', () => {
  const source = fs.readFileSync(path.resolve(__dirname, '../src/core/DailyQuest/DailyQuestRunner.ts'), 'utf8');
  assert.match(source, /claimTerminalOutcome\('timeout'\)/);
  assert.match(source, /claimTerminalOutcome\('failed'\)/);
  assert.match(source, /claimTerminalOutcome\('completed'\)/);
  assert.match(source, /if \(shutdownController\.signal\.aborted\) \{\s*return false;/);
});

test('DailyQuest sequential work and setup delays receive the shutdown signal', () => {
  const source = fs.readFileSync(path.resolve(__dirname, '../src/core/DailyQuest/DailyQuestRunner.ts'), 'utf8');
  assert.match(source, /dailyQuest\.do\(shutdownController\.signal\)/);
  assert.match(source, /dailyQuestOld\.do\(shutdownController\.signal\)/);
  assert.match(source, /sleep\(10, shutdownController\.signal\)/);
  assert.match(source, /sleep\(30, shutdownController\.signal\)/);
  assert.doesNotMatch(source, /setTimeout\(async \(\) =>/);
});

test('DailyQuest uses the shared validated configuration loader', () => {
  const source = fs.readFileSync(path.resolve(__dirname, '../src/core/DailyQuest/DailyQuestRunner.ts'), 'utf8');
  assert.match(source, /loadConfig\(\)/);
  assert.doesNotMatch(source, /const defaultConfig: config/);
  assert.doesNotMatch(source, /yamlLint\.lint/);
});

test('DailyQuest reports preflight and enabled integration initialization failures', () => {
  const source = fs.readFileSync(path.resolve(__dirname, '../src/core/DailyQuest/DailyQuestRunner.ts'), 'utf8');
  const configFailure = source.slice(source.indexOf('loadedConfig = loadConfig()'), source.indexOf('const { path: configPath'));
  const missingAwaFailure = source.slice(source.indexOf('if (missingAwaParams.length > 0)'), source.indexOf('// 检查更新'));
  assert.match(configFailure, /return false/);
  assert.match(missingAwaFailure, /return false/);
  assert.match(source, /else \{\s*failedSequentialTasks\.push\('Twitch initialization'\)/);
  assert.match(source, /else \{\s*failedSequentialTasks\.push\('Steam ASF initialization'\)/);
});

test('top-level startup failures are persisted to the Manager log', () => {
  const source = fs.readFileSync(path.resolve(__dirname, '../src/index.ts'), 'utf8');
  const failureHandler = source.slice(source.lastIndexOf('.catch((error)'), source.length);
  assert.match(failureHandler, /new Logger\(error\)/);
  assert.doesNotMatch(failureHandler, /console\.error\(error\)/);
});

test('verified updates are scheduled by the server and failures stay failures in the WebUI', () => {
  const source = fs.readFileSync(path.resolve(__dirname, '../src/webUI/static/js/pages/index.ts'), 'utf8');
  const server = fs.readFileSync(path.resolve(__dirname, '../src/server/UnifiedServer.ts'), 'utf8');
  const updateHandler = source.slice(source.indexOf('function updateHelper'), source.indexOf('async function refreshUpdateButton'));
  const failureHandler = updateHandler.slice(updateHandler.indexOf('}).catch'));
  assert.match(server, /app\.post\('\/api\/manager\/update', updateManager\)/);
  assert.match(server, /const updateManager[\s\S]*scheduleUpdate\([\s\S]*status\(202\)/);
  assert.match(updateHandler, /\/api\/manager\/update/);
  assert.match(updateHandler, /managerStatusChecker\('start'\)/);
  assert.match(failureHandler, /updateFailed/);
  assert.doesNotMatch(failureHandler, /managerStatusChecker\('start'\)/);
  assert.doesNotMatch(failureHandler, /updateSuccessManager/);
});

test('--update runs before Manager locking and startup', () => {
  const source = fs.readFileSync(path.resolve(__dirname, '../src/index.ts'), 'utf8');
  assert.ok(source.indexOf("command.kind === 'update'") < source.indexOf('new ProcessLock'));
  assert.match(source, /command\.kind === 'update'[\s\S]*scheduleUpdate/);
});

test('release metadata comes from package.json and cross-platform SEA code cache is disabled', () => {
  const sea = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../AWA-Helper-config.json'), 'utf8'));
  const release = fs.readFileSync(path.resolve(__dirname, '../.github/workflows/Release.yml'), 'utf8');
  const docker = fs.readFileSync(path.resolve(__dirname, '../.github/workflows/Docker.yml'), 'utf8');
  assert.equal(sea.useCodeCache, false);
  assert.match(release, /require\('\.\/package\.json'\)\.version/);
  assert.match(docker, /require\('\.\/package\.json'\)\.version/);
  assert.doesNotMatch(release, /^\s+version:\s+\d/m);
  assert.doesNotMatch(docker, /^\s+version:\s+\d/m);
});

test('DailyQuest database updater targets the tracked database path', () => {
  const source = fs.readFileSync(path.resolve(__dirname, '../scripts/updateDailyQuestDb.js'), 'utf8');
  assert.match(source, /src\/data\/dailyQuestDb\.json/);
  assert.doesNotMatch(source, /['"]src\/dailyQuestDb\.json['"]/);
  assert.doesNotMatch(source, /readFileSync\(['"]dailyQuestDb\.json['"]\)/);
});

test('--no-update does not emit a false automatic-update notification', () => {
  const source = fs.readFileSync(path.resolve(__dirname, '../src/tools/update/version.ts'), 'utf8');
  assert.doesNotMatch(source, /process\.argv\.includes\('--no-update'\)[\s\S]*autoUpdated/);
});

test('settings use the validated config API and legacy config routes are removed', () => {
  const settings = fs.readFileSync(path.resolve(__dirname, '../src/webUI/static/js/pages/settings.ts'), 'utf8');
  const server = fs.readFileSync(path.resolve(__dirname, '../src/server/UnifiedServer.ts'), 'utf8');
  assert.match(settings, /axios\.get\('\/api\/config'/);
  assert.match(settings, /axios\.put\('\/api\/config'/);
  assert.match(settings, /error\?\.response\?\.data/);
  assert.match(settings, /responseData\.errors\.map\(String\)\.join\('\\n'\)/);
  assert.match(settings, /data-value-type=['"]integer-array['"]/);
  assert.match(settings, /value\.defaultValue = encodeConfigValue\(config\[name\]\)/);
  assert.match(settings, /typeof value === ['"]string['"][\s\S]*return htmlEncode\(value\)/);
  assert.doesNotMatch(server, /app\.post\('\/(?:get|set)Config'/);
});
