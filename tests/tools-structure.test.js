/**
 * @file tests/tools-structure.test.js
 * @description 确保工具实现按职责拆分，避免重新堆积到导出入口中。
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');

test('tools index is an export-only facade', () => {
  const source = fs.readFileSync(path.join(root, 'src/tools/index.ts'), 'utf8');
  assert.doesNotMatch(source, /\b(class|function|const|let)\s+[A-Za-z_$]/);
  assert.ok(source.split(/\r?\n/).length <= 15);
});

test('tools subdirectories own the former monolithic implementations', () => {
  const expected = [
    'common/async.ts', 'common/values.ts', 'http/Cookie.ts', 'http/client.ts', 'http/netError.ts',
    'logging/Logger.ts', 'logging/LogContext.ts', 'notification/push.ts', 'proxy/index.ts', 'update/version.ts'
  ];
  expected.forEach((file) => assert.equal(fs.existsSync(path.join(root, 'src/tools', file)), true, file));
  const bridgeFiles = fs.readdirSync(path.join(root, 'src/tools'), {
    recursive: true
  })
    .filter((file) => String(file).endsWith('.ts'))
    .map((file) => fs.readFileSync(path.join(root, 'src/tools', String(file)), 'utf8'))
    .join('\n');
  assert.doesNotMatch(bridgeFiles, /from ['"]\.\.\/index['"]/);
});

test('source tree contains only correctly spelled Achievement identifiers', () => {
  const sourceRoot = path.join(root, 'src');
  const misspelling = new RegExp(['arch', 'ievement'].join(''), 'i');
  const files = fs.readdirSync(sourceRoot, {
    recursive: true
  })
    .map(String)
    .filter((file) => /\.(?:ts|js|html|yml|md)$/.test(file));
  for (const file of files) {
    const source = fs.readFileSync(path.join(sourceRoot, file), 'utf8');
    assert.doesNotMatch(source, misspelling, file);
  }
});
