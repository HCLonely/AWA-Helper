/**
 * @file tests/manager-lifecycle.test.js
 * @description 验证 Manager 启停与作业资源管理。
 */
const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const fixture = (mode = 'persistent') => {
  const events = [];
  let release;
  const startup = new Promise((resolve) => { release = resolve; });
  class Coordinator {
    states = {
      subscribe() {},
      list: () => []
    };
    register() {}
    beginShutdown() { this.isClosing = true; }
    async stopAll() { this.beginShutdown(); events.push('jobs stopped'); }
    async start() { events.push('job started'); return {
      success: true
    }; }
  }
  class Scheduler {
    start() { events.push('scheduler started'); }
    stop() { events.push('scheduler stopped'); }
  }
  class Server {
    async start() { await startup; events.push('server started'); }
    async stop() { events.push('server stopped'); }
  }
  class Logger {}
  const dependencies = {
    './JobCoordinator': {
      JobCoordinator: Coordinator
    },
    './Scheduler': {
      Scheduler
    },
    '../../server': {
      UnifiedServer: Server
    },
    '../../tools/config': {
      loadConfig: () => ({
        path: 'synthetic.yml',
        raw: {
          webUI: {
            enable: false
          }
        },
        manager: {
          secret: 'synthetic-manager-secret'
        }
      })
    },
    '../../tools/logging/LogWriter': {
      flushLogs: async () => { events.push('logs flushed'); }
    },
    '../../tools': {
      Logger,
      time: () => ''
    },
    './jobs': {
      DailyQuestJob: class {},
      AchievementJob: class {},
      ArtifactJob: class {}
    }
  };
  const sandbox = {
    exports: {},
    require: (name) => dependencies[name] || {},
    process: {
      env: {}
    },
    __: (key) => key,
    clearInterval
  };
  vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../dist/core/Manager/ManagerRuntime.js'), 'utf8'), sandbox);
  const runtime = new sandbox.exports.ManagerRuntime(mode, 'test');
  runtime.initializeEnvironment = () => {};
  runtime.printStartupInformation = () => {};
  runtime.scheduleAutomaticUpdate = async () => false;
  return {
    events,
    runtime,
    release
  };
};

for (const mode of ['persistent', 'once']) {
  test(`shutdown while ${mode} server starts does not launch jobs or cron`, async () => {
    const {
      runtime, events, release
    } = fixture(mode);
    const running = runtime.run();
    runtime.requestShutdown();
    release();
    await running;
    assert.equal(events.includes('job started'), false);
    assert.equal(events.includes('scheduler started'), false);
    assert.ok(events.includes('server stopped'));
  });
}

test('Manager stop callers await one completion and the server closes even if disposal fails', async () => {
  const {
    runtime, events
  } = fixture();
  runtime.coordinator.stopAll = async () => { throw new Error('disposal failed'); };
  const first = runtime.stop();
  assert.equal(runtime.stop(), first);
  await assert.rejects(first, /disposal failed/);
  assert.equal(events.filter((event) => event === 'server stopped').length, 1);
});
