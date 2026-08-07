const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { ProcessLock } = require('../dist/core/process/ProcessLock');

test('only one ProcessLock can own a live lock', async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'awa-helper-lock-'));
  const lockPath = path.join(directory, 'helper.lock');
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));

  const first = new ProcessLock(lockPath);
  const second = new ProcessLock(lockPath);

  assert.equal(await first.acquire(), true);
  assert.equal(await second.acquire(), false);
  await first.release();
  assert.equal(await second.acquire(), true);
  await second.release();
});

test('ProcessLock recovers a malformed stale lock', async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'awa-helper-lock-'));
  const lockPath = path.join(directory, 'helper.lock');
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  fs.writeFileSync(lockPath, 'not-json');
  const staleTime = new Date(Date.now() - 60_000);
  fs.utimesSync(lockPath, staleTime, staleTime);

  const lock = new ProcessLock(lockPath);
  assert.equal(await lock.acquire(), true);
  await lock.release();
});

test('ProcessLock does not remove a newly-created incomplete lock', async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'awa-helper-lock-'));
  const lockPath = path.join(directory, 'helper.lock');
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  fs.writeFileSync(lockPath, '');

  const lock = new ProcessLock(lockPath);
  assert.equal(await lock.acquire(), false);
  assert.equal(fs.existsSync(lockPath), true);
});
