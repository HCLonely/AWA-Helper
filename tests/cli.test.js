/**
 * @file tests/cli.test.js
 * @description 验证默认 Manager 模式与旧版 --helper 参数的兼容性。
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  parseArguments
} = require('../dist/cli/parseArguments');

test('no CLI arguments start persistent Manager mode', () => {
  assert.deepEqual(parseArguments([]), {
    kind: 'run',
    mode: 'persistent',
    deprecatedHelper: false,
    trayChild: false
  });
});

test('--daily and legacy --helper select one-shot Manager mode', () => {
  assert.deepEqual(parseArguments(['--daily']), {
    kind: 'run',
    mode: 'once',
    deprecatedHelper: false,
    trayChild: false
  });
  assert.deepEqual(parseArguments(['--helper']), {
    kind: 'run',
    mode: 'once',
    deprecatedHelper: true,
    trayChild: false
  });
});

test('internal tray child mode keeps persistent Manager semantics', () => {
  assert.deepEqual(parseArguments(['--manager', '--tray-child']), {
    kind: 'run',
    mode: 'persistent',
    deprecatedHelper: false,
    trayChild: true
  });
  assert.throws(() => parseArguments(['--daily', '--tray-child']), /persistent Manager/);
});

test('conflicting persistent and one-shot modes are rejected', () => {
  assert.throws(() => parseArguments(['--manager', '--daily']), /cannot be combined/);
});
