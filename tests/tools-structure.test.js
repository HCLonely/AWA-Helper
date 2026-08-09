/** Ensures tools implementations remain decomposed instead of returning to the facade. */
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
  const bridgeFiles = fs.readdirSync(path.join(root, 'src/tools'), { recursive: true })
    .filter((file) => String(file).endsWith('.ts'))
    .map((file) => fs.readFileSync(path.join(root, 'src/tools', String(file)), 'utf8'))
    .join('\n');
  assert.doesNotMatch(bridgeFiles, /from ['"]\.\.\/index['"]/);
});
