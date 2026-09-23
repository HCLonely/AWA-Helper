/**
 * @file scripts/soak-resources.js
 * @description 离线验证资源使用上限。用法：node --expose-gc scripts/soak-resources.js [秒数=120]。
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {
  monitorEventLoopDelay, performance
} = require('node:perf_hooks');
const {
  LogCache
} = require('../dist/tools/logging/LogCache');
const {
  LogWriter
} = require('../dist/tools/logging/LogWriter');
const {
  setLogSecrets, withLogSecrets, formatLogValue
} = require('../dist/tools/logging/sanitize');
const {
  SharedRead
} = require('../dist/tools/http/SharedRead');

const seconds = Number(process.argv[2] || 120);
if (!Number.isFinite(seconds) || seconds < 1 || seconds > 86400) throw new Error('Duration must be 1..86400 seconds');
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'awa-soak-'));
const delay = monitorEventLoopDelay({
  resolution: 10
});
const writer = new LogWriter(1024 * 1024, 256 * 1024);
const logs = {
  type: 'logs'
};
const cache = new LogCache(logs);
const reads = new SharedRead();
const scopes = ['manager', 'dailyQuest', 'achievement', 'artifact'];
const samples = [];
const checkpoints = [];
let records = 0;
let batches = 0;
let readCalls = 0;
const started = performance.now();
let lastSample = started;
let lastCpu = process.cpuUsage();
let nextSample = 2000;
let nextCheckpoint = 30_000;
const sampleInterval = Math.max(2000, seconds * 1000 / 60);
const checkpointInterval = Math.max(30_000, seconds * 1000 / 24);
const sample = () => {
  const now = performance.now();
  const cpu = process.cpuUsage();
  const cpuPercentOneCore = (cpu.user - lastCpu.user + cpu.system - lastCpu.system) / ((now - lastSample) * 10);
  lastSample = now; lastCpu = cpu;
  return {
    elapsedMs: now - started,
    ...process.memoryUsage(),
    cpuPercentOneCore,
    cacheBytes: cache.byteLength,
    pendingBytes: writer.pendingBytes,
    eventLoopP99Ms: delay.percentile(99) / 1e6
  };
};

const main = async () => {
  if (global.gc) global.gc();
  const initial = process.memoryUsage();
  delay.enable();
  try {
    while (performance.now() - started < seconds * 1000) {
      const secret = `synthetic-secret-${batches++}`;
      setLogSecrets({
        password: secret
      });
      await withLogSecrets({
        password: secret
      }, async () => {
        for (let index = 0; index < 10; index++) {
          const scope = scopes[records % 4];
          const data = formatLogValue(`${secret} 中文日志 ${'x'.repeat(900)}`);
          if (data.includes(secret)) throw new Error('Redaction failed');
          const entry = {
            id: records++,
            scope,
            type: 'log',
            data
          };
          cache.put(entry, JSON.stringify(entry));
          writer.enqueue(path.join(directory, `${scope}.txt`), Buffer.from(data + '\n'));
        }
        const read = async () => { readCalls++; return 'snapshot'; };
        await Promise.all([reads.get(read), reads.get(read), reads.get(read)]);
      });
      if (performance.now() - started >= nextCheckpoint) {
        if (!await writer.flush()) throw new Error('Checkpoint did not drain');
        if (global.gc) global.gc();
        checkpoints.push({
          elapsedMs: performance.now() - started,
          ...process.memoryUsage(),
          resources: process.getActiveResourcesInfo().reduce((counts, type) => { counts[type] = (counts[type] || 0) + 1; return counts; }, {})
        });
        nextCheckpoint += checkpointInterval;
      }
      if (performance.now() - started >= nextSample) {
        // 将有限的采样次数分布到整个运行过程，而非仅在末尾采样。
        if (samples.length === 60) samples.shift();
        samples.push(sample()); delay.reset();
        nextSample += sampleInterval;
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    if (!await writer.flush()) throw new Error('Writer did not drain');
    if (writer.stats.failed || writer.stats.dropped) throw new Error('Unexpected log loss');
    if (cache.byteLength > 512 * 1024 || writer.stats.peakBytes > 1024 * 1024 || readCalls !== batches) throw new Error('Resource invariant failed');
    if (global.gc) global.gc();
    console.log(JSON.stringify({
      node: process.version,
      platform: process.platform,
      seconds,
      records,
      batches,
      readCalls,
      initial,
      final: sample(),
      writer: writer.stats,
      samples,
      checkpoints,
      explicitGc: !!global.gc,
      note: 'Synthetic log/cache/secret/read lifecycle only; no real accounts, no production throughput claim.'
    }, null, 2));
  } finally {
    delay.disable(); await writer.flush();
    fs.rmSync(directory, {
      recursive: true,
      force: true
    });
  }
};
main().catch((error) => { console.error(error); process.exitCode = 1; });
