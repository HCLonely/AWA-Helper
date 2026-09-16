const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { setTimeout: delay } = require('node:timers/promises');

function findBrowser() {
  if (process.env.BROWSER_EXECUTABLE) {
    assert.ok(fs.existsSync(process.env.BROWSER_EXECUTABLE), 'BROWSER_EXECUTABLE does not exist');
    return process.env.BROWSER_EXECUTABLE;
  }
  const cache = process.env.PLAYWRIGHT_BROWSERS_PATH || (process.platform === 'win32'
    ? path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'), 'ms-playwright')
    : path.join(os.homedir(), '.cache', 'ms-playwright'));
  const cached = fs.existsSync(cache) ? fs.readdirSync(cache).filter(name => name.startsWith('chromium_headless_shell-'))
    .sort((a, b) => b.localeCompare(a, undefined, { numeric: true })).flatMap(name => [
      path.join(cache, name, 'chrome-headless-shell-win64', 'chrome-headless-shell.exe'),
      path.join(cache, name, 'chrome-linux', 'headless_shell'),
      path.join(cache, name, 'chrome-headless-shell-linux64', 'chrome-headless-shell'),
      path.join(cache, name, 'chrome-headless-shell-mac-arm64', 'chrome-headless-shell')
    ]) : [];
  return [...cached, 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    '/usr/bin/chromium', '/usr/bin/google-chrome'].find(file => fs.existsSync(file));
}

/** Wait for an explicit page result on a real clock, so requestAnimationFrame is exercised too. */
async function runBrowser(url, { executable = findBrowser(), timeout = 20000 } = {}) {
  assert.ok(executable, 'No Chromium browser found; set BROWSER_EXECUTABLE');
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'awa-browser-'));
  let child;
  let send;
  let diagnostics = '';
  try {
    child = spawn(executable, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
      '--disable-background-networking', `--user-data-dir=${directory}`, '--remote-debugging-pipe', 'about:blank'],
    { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe', 'pipe', 'pipe'] });
    const pending = new Map();
    let nextId = 0;
    let buffer = '';
    let closed;
    const disconnect = (error) => {
      closed = error;
      for (const { reject } of pending.values()) reject(error);
      pending.clear();
    };
    child.once('error', disconnect);
    child.once('exit', (code) => disconnect(new Error(`Browser exited (${code}): ${diagnostics}`)));
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', text => { diagnostics = (diagnostics + text).slice(-3000); });
    child.stdio[3].on('error', disconnect);
    child.stdio[4].on('error', disconnect);
    child.stdio[4].setEncoding('utf8');
    child.stdio[4].on('data', text => {
      buffer += text;
      let end;
      while ((end = buffer.indexOf('\0')) !== -1) {
        const message = JSON.parse(buffer.slice(0, end));
        buffer = buffer.slice(end + 1);
        const callback = pending.get(message.id);
        if (callback) {
          pending.delete(message.id);
          if (message.error) callback.reject(new Error(message.error.message));
          else callback.resolve(message.result);
        } else if (message.method === 'Runtime.exceptionThrown') {
          diagnostics += JSON.stringify(message.params.exceptionDetails);
        }
      }
    });
    send = (method, params = {}, sessionId, limit = 5000) => new Promise((resolve, reject) => {
      if (closed) { reject(closed); return; }
      const id = ++nextId;
      const timer = setTimeout(() => { pending.delete(id); reject(new Error(`${method} timed out: ${diagnostics}`)); }, limit);
      pending.set(id, {
        resolve: result => { clearTimeout(timer); resolve(result); },
        reject: error => { clearTimeout(timer); reject(error); }
      });
      child.stdio[3].write(JSON.stringify({ id, method, params, sessionId }) + '\0');
    });
    const { targetInfos } = await send('Target.getTargets');
    const target = targetInfos.find(info => info.type === 'page');
    assert.ok(target, 'Browser did not create a page');
    const { sessionId } = await send('Target.attachToTarget', { targetId: target.targetId, flatten: true });
    await send('Runtime.enable', {}, sessionId);
    await send('Page.enable', {}, sessionId);
    await send('Page.bringToFront', {}, sessionId);
    const navigation = await send('Page.navigate', { url }, sessionId);
    assert.equal(navigation.errorText, undefined, navigation.errorText);
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      const result = await send('Runtime.evaluate', {
        expression: 'document.querySelector("#test-result")?.textContent ?? null', returnByValue: true
      }, sessionId);
      if (typeof result.result?.value === 'string') return JSON.parse(result.result.value);
      await delay(25);
    }
    throw new Error(`Page did not publish #test-result within ${timeout} ms (${url}): ${diagnostics}`);
  } finally {
    if (child) {
      if (send && child.exitCode === null) {
        try { await send('Browser.close', {}, undefined, 2000); } catch { /* The browser may disconnect before acknowledging close. */ }
      }
      if (child.exitCode === null) {
        await Promise.race([new Promise(resolve => child.once('exit', resolve)), delay(2000)]);
        if (child.exitCode === null) child.kill();
      }
      child.stdio.forEach(stream => stream?.destroy());
    }
    const resolved = path.resolve(directory);
    assert.ok(resolved.startsWith(path.resolve(os.tmpdir()) + path.sep) && path.basename(resolved).startsWith('awa-browser-'));
    fs.rmSync(resolved, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  }
}

module.exports = { findBrowser, runBrowser };
