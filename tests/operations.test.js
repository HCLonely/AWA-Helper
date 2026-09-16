/**
 * @file tests/operations.test.js
 * @description 验证运行历史、调度预览与连接诊断接口。
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const {
  RunHistory, withRunHistory, trackRunStep
} = require('../dist/core/Manager/RunHistory');
const {
  Scheduler
} = require('../dist/core/Manager/Scheduler');
const {
  JobCoordinator
} = require('../dist/core/Manager/JobCoordinator');
const {
  Diagnostics, classifyDiagnosticError
} = require('../dist/core/Manager/Diagnostics');
const {
  PageParseError, parseVerifiedControlCenter
} = require('../dist/client/AWA/parsers/verifiedControlCenter');
const {
  withLogSecrets
} = require('../dist/tools/logging/sanitize');
const {
  validateHelperConfig
} = require('../dist/tools/config/ConfigSchema');
const {
  normalizeManagerConfig
} = require('../dist/tools/config/ConfigMigration');
const {
  defaultConfig
} = require('../dist/tools/config/ConfigLoader');
const {
  DailyTask
} = require('../dist/core/DailyQuest/tasks/DailyTask');

global.__ = key => key;
global.log = false;
global.webUI = false;
const sample = name => fs.readFileSync(path.join(__dirname, 'fixtures/control-center/v1', `${name}.html`), 'utf8');
const config = extra => ({
  secret: 'synthetic-manager-secret',
  timezone: 'UTC',
  achievement: {
    enable: false
  },
  artifacts: [],
  ...extra
});
const pause = () => new Promise(setImmediate);
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return {
  promise,
  resolve
}; };
function directory(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'awa-operations-'));
  t.after(() => fs.rmSync(dir, {
    recursive: true,
    force: true
  }));
  return dir;
}

test('history survives restart, marks unfinished runs interrupted and leaves finished records intact', async t => {
  const file = path.join(directory(t), 'history.json');
  const first = new RunHistory(); first.open(file, 10);
  const completed = first.begin('dailyQuest', 'schedule'); first.finish(completed, 'completed');
  const interrupted = first.begin('achievement', 'manual');
  first.step(interrupted, {
    name: 'Twitch',
    status: 'running',
    startedAt: new Date().toISOString()
  });
  const second = new RunHistory(); second.open(file, 10);
  const [run, previous] = second.list();
  assert.equal(run.status, 'interrupted'); assert.equal(run.steps[0].status, 'interrupted');
  assert.equal(previous.status, 'completed'); assert.equal(second.failures('achievement'), 1);
  run.steps[0].status = 'tampered'; assert.equal(second.list()[0].steps[0].status, 'interrupted');
});

test('history bounds completed runs while keeping active runs and records sanitized step failures', async t => {
  const history = new RunHistory(); const file = path.join(directory(t), 'history.json'); history.open(file, 10);
  const active = history.begin('achievement', 'manual');
  for (let i = 0; i < 20; i++) { const id = history.begin('dailyQuest', 'schedule'); history.finish(id, 'completed'); }
  assert.equal(history.list().length, 10); assert.ok(history.list().some(run => run.id === active));
  await withLogSecrets({
    awaCookie: 'REMEMBERME=synthetic-sensitive-value'
  }, async () => {
    await assert.rejects(withRunHistory(history, active, () => trackRunStep('failure', async () => {
      throw new Error('failed synthetic-sensitive-value');
    })), /failed/);
  });
  const step = history.list().find(run => run.id === active).steps[0];
  assert.equal(step.status, 'failed'); assert.ok(step.finishedAt);
  assert.equal(fs.readFileSync(file, 'utf8').includes('synthetic-sensitive-value'), false);
});

test('corrupt history is preserved and storage failures remain visible', t => {
  const dir = directory(t); const file = path.join(dir, 'history.json'); fs.writeFileSync(file, '{broken');
  const history = new RunHistory(); history.open(file);
  assert.ok(history.storageError); assert.ok(fs.readdirSync(dir).some(name => name.startsWith('history.json.corrupt-')));
  fs.rmSync(file); fs.mkdirSync(file); history.begin('dailyQuest', 'manual'); assert.ok(history.storageError);
});

test('malformed nested history is quarantined instead of crashing startup', t => {
  const file = path.join(directory(t), 'history.json');
  fs.writeFileSync(file, JSON.stringify({
    version: 1,
    runs: [{
      id: 'old',
      name: 'dailyQuest',
      source: 'schedule',
      status: 'running',
      startedAt: new Date().toISOString(),
      steps: [null]
    }]
  }));
  const history = new RunHistory(); assert.doesNotThrow(() => history.open(file)); assert.ok(history.storageError);
});

test('coordinator records one run for duplicate requests, the trigger source, child results and cancellation', async () => {
  const coordinator = new JobCoordinator(); const ready = deferred();
  coordinator.register({
    name: 'dailyQuest',
    run: signal => trackRunStep('wait', async () => {
      ready.resolve(); await new Promise(resolve => signal.addEventListener('abort', resolve, {
        once: true
      })); return false;
    })
  });
  const running = coordinator.start('dailyQuest', undefined, 'schedule');
  assert.equal(coordinator.start('dailyQuest'), running); await ready.promise; await coordinator.stop('dailyQuest');
  assert.equal(coordinator.history.list().length, 1);
  const [record] = coordinator.history.list(); assert.equal(record.source, 'schedule'); assert.equal(record.status, 'cancelled');
  assert.equal(record.steps.length, 1); assert.equal(coordinator.states.get('dailyQuest').runId, record.id);
});

test('Cron preview handles timezones, leap days and AND semantics for date plus weekday', () => {
  assert.equal(Scheduler.preview('0 14 * * *', 'Asia/Shanghai', new Date('2026-09-15T00:00:00Z'))[0], '2026-09-15T06:00:00.000Z');
  assert.equal(Scheduler.preview('0 0 29 2 *', 'UTC', new Date('2026-01-01T00:00:00Z'))[0], '2028-02-29T00:00:00.000Z');
  const dates = Scheduler.preview('0 0 1 * MON', 'UTC', new Date('2026-01-02T00:00:00Z'));
  assert.ok(dates.every(date => new Date(date).getUTCDate() === 1 && new Date(date).getUTCDay() === 1));
  assert.throws(() => Scheduler.preview('invalid', 'UTC'));
  assert.throws(() => Scheduler.preview('* * * * *', 'Invalid/Zone'));
});

test('Cron preview uses the selected timezone across a daylight-saving change', () => {
  const dates = Scheduler.preview('0 9 * * *', 'America/New_York', new Date('2026-03-07T00:00:00Z'));
  assert.equal(dates[0], '2026-03-07T14:00:00.000Z'); assert.equal(dates[1], '2026-03-08T13:00:00.000Z');
});

test('manual stop invalidates a pending scheduled request', async t => {
  const coordinator = new JobCoordinator(); let runs = 0;
  coordinator.register({
    name: 'dailyQuest',
    run: signal => new Promise(resolve => {
      runs++; signal.addEventListener('abort', () => resolve(false), {
        once: true
      });
    })
  });
  const scheduler = new Scheduler(coordinator, config({})); scheduler.start(); t.after(() => scheduler.stop());
  coordinator.start('dailyQuest'); await pause(); const pending = scheduler.restart('dailyQuest');
  scheduler.cancelPending('dailyQuest'); await coordinator.stop('dailyQuest'); await pending; assert.equal(runs, 1);
});

test('diagnostic probes respect Retry-After beyond the normal result cache', async () => {
  const diagnostics = new Diagnostics(); const raw = {
    ...defaultConfig,
    awaCookie: 'REMEMBERME=synthetic-rate-limit'
  };
  let calls = 0;
  const transport = {
    request: async () => { calls++; throw {
      response: {
        status: 429,
        headers: {
          'retry-after': '120'
        }
      }
    }; }
  };
  const first = await diagnostics.run(raw, transport); assert.equal(first[0].code, 'rate-limited');
  diagnostics.latest[0].checkedAt = new Date(Date.now() - 40000).toISOString();
  const second = await diagnostics.run(raw, transport); assert.equal(calls, 1); assert.equal(second[0].retryAt, first[0].retryAt);
});

test('scheduler startup and reload wait for future triggers without starting interrupted jobs', async t => {
  const coordinator = new JobCoordinator(); let runs = 0;
  coordinator.register({
    name: 'dailyQuest',
    run: async () => { runs++; return true; }
  });
  const id = coordinator.history.begin('dailyQuest', 'schedule'); coordinator.history.finish(id, 'interrupted');
  const settings = config({
    dailyQuestCron: '0 0 29 2 *'
  });
  const scheduler = new Scheduler(coordinator, settings); t.after(() => scheduler.stop());
  scheduler.start(); await pause(); scheduler.reload(settings); await pause();
  assert.equal(runs, 0); assert.equal(coordinator.history.list().length, 1);
  assert.equal(coordinator.history.list()[0].status, 'interrupted');
});

test('versioned page fixtures distinguish empty tasks, expired cookies, network rejection and layout changes', () => {
  assert.ok(parseVerifiedControlCenter(sample('normal'), 'https://arena.example').questInfo);
  assert.equal(parseVerifiedControlCenter(sample('empty'), 'https://arena.example').questInfo.dailyQuest.length, 0);
  assert.throws(() => parseVerifiedControlCenter(sample('expired'), 'https://arena.example'), error => error.statusCode === 602);
  assert.throws(() => parseVerifiedControlCenter(sample('network-error'), 'https://arena.example'), error => error.statusCode === 610);
  assert.throws(() => parseVerifiedControlCenter(sample('changed'), 'https://arena.example'), error => error instanceof PageParseError && error.missingFields.length > 0);
  assert.throws(() => parseVerifiedControlCenter(sample('empty').replace('timeOnSiteCap', 'renamedCap'), 'https://arena.example'), /timeOnSiteCap/);
});

test('a reloaded completed daily quest does not claim its reward again', async () => {
  let claims = 0;
  const task = new DailyTask({
    state: {
      questInfo: {
        dailyQuest: [{
          id: '42',
          status: 'complete'
        }]
      }
    },
    claimQuest: async () => { claims++; }
  });
  assert.equal(await task.do(), true); assert.equal(claims, 0);
});

test('diagnostics classify wrapped 429 responses, login failures and parser metadata without returning credentials', () => {
  const result = classifyDiagnosticError('awa', new Error('synthetic-secret', {
    cause: {
      response: {
        status: 429,
        headers: {
          'retry-after': '120',
          cookie: 'secret'
        }
      }
    }
  }));
  assert.equal(result.code, 'rate-limited'); assert.ok(Date.parse(result.retryAt) > Date.now() + 119000);
  assert.equal(JSON.stringify(result).includes('secret'), false);
  assert.equal(classifyDiagnosticError('asf', {
    response: {
      status: 401
    }
  }).code, 'session-expired');
  assert.deepEqual(classifyDiagnosticError('awa', new PageParseError(['dailyArpData'])).missingFields, ['dailyArpData']);
});

test('connection diagnostics use read-only probes, validate Twitch authorization, and coalesce duplicate requests', async () => {
  const diagnostics = new Diagnostics(); const requests = [];
  const transport = {
    request: async options => {
      requests.push(options);
      if (options.url.includes('control-center')) return {
        data: sample('empty'),
        status: 200,
        headers: {}
      };
      if (options.url === 'https://www.twitch.tv/') return {
        data: '<script>clientId="fixtureclientid"</script>',
        status: 200,
        headers: {}
      };
      if (options.url.includes('gql.twitch')) return {
        data: [{
          data: {
            currentUser: {
              linkedExtensions: []
            }
          }
        }],
        status: 200,
        headers: {}
      };
      return {
        data: {
          Success: true
        },
        status: 200,
        headers: {}
      };
    }
  };
  const raw = {
    ...defaultConfig,
    awaCookie: 'REMEMBERME=synthetic-awa',
    awaQuests: ['watchTwitch', 'steamQuest'],
    twitchCookie: 'auth-token=synthetic-token; unique_id=synthetic-id',
    asfHost: 'localhost',
    asfPort: 1242,
    asfBotname: 'fixture'
  };
  const first = diagnostics.run(raw, transport); assert.equal(first, diagnostics.run(raw, transport));
  const checks = await first; assert.equal(checks[0].code, 'ok'); assert.equal(checks[2].code, 'ok');
  assert.equal(checks[1].code, 'extension-missing');
  assert.ok(requests.every(request => request.method === 'GET' || request.url === 'https://gql.twitch.tv/gql'));
  const count = requests.length; await diagnostics.run(raw, transport); assert.equal(requests.length, count);
  await diagnostics.run({
    ...raw,
    awaCookie: ''
  }, transport); assert.equal(diagnostics.snapshot()[0].code, 'missing-config');
});

test('new configuration fields validate and preserve compatibility defaults', () => {
  const normalized = normalizeManagerConfig({
    ...defaultConfig,
    manager: {}
  });
  assert.equal(normalized.historyLimit, 200);
  const raw = {
    ...defaultConfig,
    manager: {
      timezone: 'Invalid/Zone',
      historyLimit: 0
    }
  };
  const errors = validateHelperConfig(raw); assert.equal(errors.filter(error => error.startsWith('manager.')).length, 2);
});

test('operations API requires authentication, validates previews and exports parseable redacted JSON', async t => {
  const vm = require('node:vm');
  const http = require('node:http');
  const {
    createRequire
  } = require('node:module');
  const {
    setLogSecrets
  } = require('../dist/tools/logging/sanitize');
  const moduleFile = path.resolve(__dirname, '../dist/server/UnifiedServer.js');
  const localRequire = createRequire(moduleFile);
  const sandbox = {
    exports: {},
    require: name => {
      if (name.endsWith('/operations.html')) return '<main id="operations">__VERSION__</main>';
      if (name.includes('webUI/') || name.includes('locales/')) return '';
      return localRequire(name);
    },
    Buffer,
    process,
    setInterval,
    clearInterval,
    setTimeout,
    clearTimeout,
    setImmediate,
    __: key => key,
    globalThis: global,
    structuredClone
  };
  vm.runInNewContext(fs.readFileSync(moduleFile, 'utf8'), sandbox);
  const free = http.createServer(); await new Promise(resolve => free.listen(0, '127.0.0.1', resolve));
  const {
    port
  } = free.address(); await new Promise(resolve => free.close(resolve));
  const previous = process.cwd(); process.chdir(directory(t));
  t.after(() => process.chdir(previous));
  fs.mkdirSync('logs'); fs.writeFileSync(path.join('logs', `Manager-${require('dayjs')().format('YYYY-MM-DD')}.txt`), 'diagnostic synthetic-export-secret');
  setLogSecrets({
    manager: {
      secret: 'synthetic-export-secret'
    }
  });
  const coordinator = new JobCoordinator(); coordinator.register({
    name: 'dailyQuest',
    run: async () => true
  });
  await coordinator.start('dailyQuest');
  const settings = config({
    dailyQuestCron: '0 14 * * *'
  });
  const loaded = {
    path: 'unused.yml',
    manager: settings,
    raw: {
      ...defaultConfig,
      awaCookie: '',
      webUI: {
        enable: true,
        local: true,
        port
      }
    }
  };
  global.wsClients = new Set();
  const scheduler = new Scheduler(coordinator, settings);
  const server = new sandbox.exports.UnifiedServer(loaded, coordinator, 'fixture-version', () => {}, () => ({
    restartRequired: false
  }), scheduler);
  await server.start();
  try {
    const origin = `http://127.0.0.1:${port}`;
    const page = await fetch(`${origin}/operations`);
    assert.equal(page.status, 200);
    assert.equal(await page.text(), '<main id="operations">fixture-version</main>');
    for (const url of ['/api/history', '/api/schedules', '/api/diagnostics/export']) {
      assert.equal((await fetch(origin + url)).status, 401);
    }
    assert.equal((await fetch(`${origin}/api/diagnostics`, {
      method: 'POST'
    })).status, 401);
    const headers = {
      Authorization: `Bearer ${settings.secret}`,
      'Content-Type': 'application/json'
    };
    const history = await (await fetch(`${origin}/api/history`, {
      headers
    })).json(); assert.equal(history.runs.length, 1);
    const preview = await fetch(`${origin}/api/schedules/preview`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        cron: 'bad',
        timezone: 'UTC'
      })
    });
    assert.equal(preview.status, 400);
    const checks = await (await fetch(`${origin}/api/diagnostics`, {
      method: 'POST',
      headers,
      body: '{}'
    })).json();
    assert.equal(checks.checks[0].code, 'missing-config');
    const exported = await fetch(`${origin}/api/diagnostics/export`, {
      headers
    });
    assert.equal(exported.headers.get('cache-control'), 'no-store');
    assert.match(exported.headers.get('content-disposition'), /awa-diagnostics.json/);
    const body = await exported.text(); const bundle = JSON.parse(body);
    assert.equal(bundle.version, 'fixture-version'); assert.equal(bundle.runs.length, 1); assert.equal(bundle.logs.length, 4);
    assert.equal(body.includes('synthetic-export-secret'), false); assert.equal(body.includes(settings.secret), false);
    coordinator.beginShutdown();
    assert.equal((await fetch(`${origin}/api/diagnostics`, {
      method: 'POST',
      headers,
      body: '{}'
    })).status, 503);
  } finally { await server.stop(); setLogSecrets({}); process.chdir(previous); }
});

for (const scenario of ['cached', 'missing-output', 'download-failure']) {
  test(`Windows icon packaging fails closed and reuses its local tool: ${scenario}`, async () => {
    const vm = require('node:vm');
    let output = false;
    let downloads = 0;
    const module = {
      exports: {}
    };
    const fakeFs = {
      existsSync: file => file.endsWith('ResourceHacker.exe') ? scenario !== 'download-failure' : (file.endsWith('AWA-Helper.exe') && output),
      statSync: () => ({
        size: 128
      }),
      rmSync() {},
      mkdirSync() {}
    };
    const dependencies = {
      fs: fakeFs,
      path,
      'stream/promises': {},
      axios: {
        get: async () => { downloads++; throw new Error('Download unavailable'); }
      },
      child_process: {
        execFileSync: () => { output = scenario === 'cached'; }
      }
    };
    const sandbox = {
      module,
      exports: module.exports,
      require: name => dependencies[name],
      console: {
        log() {},
        error() {}
      }
    };
    vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../scripts/icon.js'), 'utf8'), sandbox);
    if (scenario === 'cached') await module.exports.applyIcon();
    else await assert.rejects(module.exports.applyIcon(), /Download unavailable|did not produce/);
    assert.equal(downloads, scenario === 'download-failure' ? 1 : 0);
  });
}
