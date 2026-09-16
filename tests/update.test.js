/**
 * @file tests/update.test.js
 * @description 验证版本比较、平台资源选择与归档处理边界。
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  isNewVersion
} = require('../dist/tools/update/version');
const {
  getAssetNameForRuntime, isSourceRuntime, safeRelativePath
} = require('../dist/tools/update/installer');

test('release versions use semantic ordering', () => {
  assert.equal(isNewVersion('v3.4.8', '3.4.9'), true);
  assert.equal(isNewVersion('3.4.8', '3.4.8'), false);
  assert.equal(isNewVersion('3.4.9', '3.4.8'), false);
  assert.equal(isNewVersion('3.4.8-beta.1', '3.4.8'), true);
  assert.equal(isNewVersion('3.4.8', '3.4.9-beta.1'), true);
  assert.equal(isNewVersion('not-a-version', '3.4.9'), false);
});

test('updater selects the release asset for each supported runtime', () => {
  assert.equal(getAssetNameForRuntime('Windows_NT', 'x64', false), 'AWA-Helper-Win.tar.gz');
  assert.equal(getAssetNameForRuntime('Linux', 'x64', false), 'AWA-Helper-Linux-x64.tar.gz');
  assert.equal(getAssetNameForRuntime('Linux', 'arm', false), 'AWA-Helper-Linux-armv7.tar.gz');
  assert.equal(getAssetNameForRuntime('Linux', 'arm64', false), 'AWA-Helper-Linux-armv8.tar.gz');
  assert.equal(getAssetNameForRuntime('Darwin', 'arm64', true), 'index.js');
  assert.throws(() => getAssetNameForRuntime('Darwin', 'arm64', false), /not available/);
  assert.equal(isSourceRuntime('/opt/awa/index.js'), true);
  assert.equal(isSourceRuntime('C:\\AWA-Helper\\AWA-Helper.exe'), false);
});

test('archive entries stay under the expected output root', () => {
  assert.equal(safeRelativePath('./output/AWA-Helper'), 'output/AWA-Helper');
  assert.throws(() => safeRelativePath('../output/AWA-Helper'), /Unsafe archive path/);
  assert.throws(() => safeRelativePath('/output/AWA-Helper'), /Unsafe archive path/);
  assert.throws(() => safeRelativePath('payload/AWA-Helper'), /Unexpected archive root/);
});
