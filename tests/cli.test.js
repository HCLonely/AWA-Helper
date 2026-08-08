/** @description Verifies default Manager mode and legacy --helper compatibility. */
const test = require('node:test');
const assert = require('node:assert/strict');
const { parseArguments } = require('../dist/cli/parseArguments');

test('no CLI arguments start persistent Manager mode', () => {
  assert.deepEqual(parseArguments([]), { kind: 'run', mode: 'persistent', deprecatedHelper: false });
});

test('--daily and legacy --helper select one-shot Manager mode', () => {
  assert.deepEqual(parseArguments(['--daily']), { kind: 'run', mode: 'once', deprecatedHelper: false });
  assert.deepEqual(parseArguments(['--helper']), { kind: 'run', mode: 'once', deprecatedHelper: true });
});

test('conflicting persistent and one-shot modes are rejected', () => {
  assert.throws(() => parseArguments(['--manager', '--daily']), /cannot be combined/);
});
