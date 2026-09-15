/** Offline comparison. Usage: node scripts/benchmark-resources.js <built-output-directory> */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const vm = require('node:vm');
const { execFileSync, spawn } = require('node:child_process');
const { createRequire } = require('node:module');
const { performance } = require('node:perf_hooks');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
const baseline = '330080b5dc407b352361be87582a75503fe0f851';
const loggerPath = 'src/tools/logging/Logger.ts';
const localRequire = createRequire(path.join(root, 'dist/tools/logging/Logger.js'));
// Keep current formatting/encoding work, but disable the actual filesystem sink.
const writer = localRequire('./LogWriter');
writer.logWriter.enqueue = () => true;
const original = execFileSync('git', ['show', `${baseline}:${loggerPath}`], { cwd: root, encoding: 'utf8' });
const current = fs.readFileSync(path.join(root, loggerPath), 'utf8');

const summarize = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
  return { min: sorted[0], median, max: sorted.at(-1) };
};

const logSample = (source) => {
  let scope = 'manager';
  const sandbox = {
    exports: {}, Buffer, Date, Set, Map,
    process: { stdout: { isTTY: false }, env: {} },
    require: (name) => {
      if (name === 'fs-extra') return { mkdirSync() {}, existsSync: () => false, appendFileSync() {} };
      if (name === './LogWriter') return writer;
      if (name === './LogContext') return { getLogScope: () => scope, getLogFilePath: () => 'synthetic.txt' };
      return localRequire(name);
    }
  };
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText, sandbox);
  sandbox.webUI = true;
  sandbox.log = false;
  const scopes = ['manager', 'dailyQuest', 'achievement', 'artifact'];
  const payload = '中文 synthetic log '.repeat(30);
  const start = performance.now();
  const cpuStart = process.cpuUsage();
  for (let index = 0; index < 3000; index++) {
    scope = scopes[index % scopes.length];
    const logger = new sandbox.exports.Logger(payload, false);
    if (index % 10 === 0) logger.log(' updated');
  }
  const cpu = process.cpuUsage(cpuStart);
  return { wallMs: performance.now() - start, cpuMs: (cpu.user + cpu.system) / 1000,
    cacheBytes: Buffer.byteLength(JSON.stringify(sandbox.logs)) };
};

const probeSample = (directory, entry, preload, expectedCode = 0) => new Promise((resolve, reject) => {
  const start = performance.now();
  const child = spawn(process.execPath, ['--require', preload, path.join(directory, entry), ...(entry === 'index.js' ? ['--healthcheck'] : [])],
    { cwd: directory, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  let output = '';
  child.stdout.on('data', (chunk) => { output += chunk; });
  child.stderr.resume();
  child.once('error', reject);
  child.once('close', (code) => {
    if (code !== expectedCode) return reject(new Error(`Probe exited ${code}, expected ${expectedCode}`));
    resolve({ ...JSON.parse(output.trim()), wallMs: performance.now() - start });
  });
});

const main = async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'awa-resource-probes-'));
  const build = path.resolve(process.argv[2] || path.join(root, 'output'));
  const server = http.createServer((_req, res) => res.end('ok'));
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    for (const entry of ['index.js', 'healthcheck.js']) fs.copyFileSync(path.join(build, entry), path.join(directory, entry));
    fs.writeFileSync(path.join(directory, 'config.yml'), `webUI:\n  port: ${server.address().port}\n`);
    const preload = path.join(directory, 'measure.cjs');
    fs.writeFileSync(preload, `const cpu=process.cpuUsage();process.once('exit',()=>{const used=process.cpuUsage(cpu);console.log(JSON.stringify({peakRssMiB:process.resourceUsage().maxRSS/1024,cpuMs:(used.user+used.system)/1000}));});`);
    logSample(original); logSample(current);
    const oldLogs = []; const newLogs = [];
    for (let index = 0; index < 5; index++) { oldLogs.push(logSample(original)); newLogs.push(logSample(current)); }
    const probes = { 'index.js': [], 'healthcheck.js': [] };
    for (let index = 0; index < 20; index++) {
      for (const entry of Object.keys(probes)) probes[entry].push(await probeSample(directory, entry, preload));
    }
    for (const invalid of ['webUI:\n  enable: false\n', 'webUI: [\n']) {
      fs.writeFileSync(path.join(directory, 'config.yml'), invalid);
      for (const entry of Object.keys(probes)) await probeSample(directory, entry, preload, 1);
    }
    const unexpected = fs.readdirSync(directory).filter((name) => !['index.js', 'healthcheck.js', 'config.yml', 'measure.cjs'].includes(name));
    if (unexpected.length) throw new Error(`Probe created runtime files: ${unexpected.join(', ')}`);
    const summary = (samples) => Object.fromEntries(Object.keys(samples[0]).map((key) => [key, summarize(samples.map((sample) => sample[key]))]));
    console.log(JSON.stringify({ node: process.version, platform: process.platform, baseline, probeInvalidConfigChecks: 4, probeCreatedRuntimeFiles: false,
      note: 'Offline synthetic log path (disk/network disabled), 3000 entries + 300 upserts, four scopes; probe CPU measured after preload; wall includes process startup; current build entries compared, no production workload.',
      logs: { before: summary(oldLogs), after: summary(newLogs), samples: { before: oldLogs, after: newLogs } },
      probes: Object.fromEntries(Object.entries(probes).map(([entry, samples]) => [entry, { summary: summary(samples), samples }])) }, null, 2));
  } finally {
    await new Promise((resolve) => server.close(resolve));
    // Only the freshly created, known temporary directory is removed.
    fs.rmSync(directory, { recursive: true, force: true });
  }
};

main().catch((error) => { console.error(error); process.exitCode = 1; });
