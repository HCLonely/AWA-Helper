/** Local integration check against a built JS bundle or Windows SEA executable. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const WebSocket = require('ws');

const main = async () => {
  const source = path.resolve(process.argv[2]);
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'awa-built-runtime-'));
  const entry = path.join(directory, path.basename(source));
  fs.copyFileSync(source, entry);
  const reserved = http.createServer();
  // Windows can allocate ephemeral ports that fetch deliberately blocks (e.g. 6665).
  for (;;) {
    try {
      await new Promise((resolve, reject) => {
        reserved.once('error', reject);
        reserved.listen(20000 + Math.floor(Math.random() * 40000), '127.0.0.1', resolve);
      });
      break;
    } catch (error) {
      if (error.code !== 'EADDRINUSE') throw error;
    } finally {
      reserved.removeAllListeners('error');
    }
  }
  const port = reserved.address().port;
  await new Promise((resolve) => reserved.close(resolve));
  const secret = 'synthetic-runtime-manager-secret';
  fs.writeFileSync(path.join(directory, 'config.yml'), `language: en\nawaCookie: REMEMBERME=synthetic\nautoUpdate: false\nwebUI:\n  enable: true\n  port: ${port}\n  local: true\nmanager:\n  secret: ${secret}\n  achievement:\n    enable: false\n  artifacts: []\n`);
  const executable = entry.endsWith('.exe');
  const child = spawn(executable ? entry : process.execPath, executable ? ['--manager', '--no-update'] : [entry, '--manager', '--no-update'],
    { cwd: directory, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  let diagnostics = '';
  for (const stream of [child.stdout, child.stderr]) stream.on('data', (chunk) => { diagnostics = (diagnostics + chunk).slice(-3000); });
  const closed = once(child, 'close');
  const base = `http://127.0.0.1:${port}`;
  const headers = { Authorization: `Bearer ${secret}` };
  let socket;
  try {
    let ready = false;
    for (let attempt = 0; attempt < 100; attempt++) {
      ready = await fetch(base + '/api/health/live').then((response) => response.ok, () => false);
      if (ready) break;
      if (child.exitCode !== null) throw new Error(diagnostics);
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    assert.ok(ready, diagnostics);
    for (const route of ['/', '/achievement']) {
      const page = await fetch(base + route).then((response) => response.text());
      assert.ok(page.includes('showModal') && page.includes('/page'), 'Preview script was not included in built page');
    }
    const now = new Date();
    const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const log = '中文😀 log\n'.repeat(10000);
    fs.writeFileSync(path.join(directory, 'logs', `DailyQuest-${date}.txt`), log);
    assert.equal((await fetch(base + '/api/logs/dailyQuest/page')).status, 401);
    const page = await fetch(base + '/api/logs/dailyQuest/page', { headers }).then((response) => response.json());
    assert.ok(Buffer.byteLength(page.text) <= 65536 && page.older);
    const earlier = await fetch(base + `/api/logs/dailyQuest/page?cursor=${page.older}`, { headers }).then((response) => response.json());
    assert.ok(earlier.text && !earlier.reset);
    assert.equal((await fetch(base + '/api/logs/dailyQuest/page?cursor=invalid', { headers })).status, 400);
    assert.equal(await fetch(base + '/api/logs/dailyQuest', { headers }).then((response) => response.text()), log);
    assert.equal((await fetch(base + '/api/logs/dailyQuest/download-ticket', { method: 'POST', headers })).status, 404);
    assert.equal((await fetch(base + '/api/logs/dailyQuest/download?ticket=unused')).status, 404);
    socket = new WebSocket(`ws://127.0.0.1:${port}/ws?scope=manager&replay=chunks`, ['awa-manager', Buffer.from(secret).toString('base64url')]);
    const messages = [];
    socket.on('message', (message) => messages.push(JSON.parse(message.toString())));
    await once(socket, 'open');
    await fetch(base + '/api/jobs/artifact/stop', { method: 'POST', headers });
    for (let attempt = 0; attempt < 30 && !messages.some((message) => message.type === 'log'); attempt++) await new Promise((resolve) => setTimeout(resolve, 50));
    assert.ok(messages.some((message) => message.type === 'logs'));
    assert.ok(messages.some((message) => message.type === 'log'));
    const firstLive = messages.findIndex((message) => message.type === 'log');
    assert.ok(messages.slice(0, firstLive).every((message) => message.type === 'logs'));
    assert.ok(messages.slice(firstLive).every((message) => message.type !== 'logs'));
    assert.ok(messages.every((message) => message.type === 'logs' || message.scope === 'manager'));
    await fetch(base + '/api/manager/shutdown', { method: 'POST', headers });
    const deadline = setTimeout(() => child.kill(), 10000);
    const [code] = await closed;
    clearTimeout(deadline);
    assert.equal(code, 0, diagnostics);
    console.log(JSON.stringify({ entry: path.basename(entry), authenticatedPages: true, previewBundled: true,
      onlinePreviewOnly: true, nativeDownloadRoutesRemoved: true,
      orderedReplayAndLiveMessages: true, gracefulExit: code }));
  } finally {
    socket?.terminate();
    if (child.exitCode === null) child.kill();
    await closed;
    fs.rmSync(directory, { recursive: true, force: true });
  }
};

main().catch((error) => { console.error(error); process.exitCode = 1; });
