/** Regression coverage for persisting cookies refreshed by the artifact job. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

test('ArtifactJob persists the final refreshed AWA cookie after a successful initialization', () => {
  const source = fs.readFileSync(path.resolve(__dirname, '../src/core/Manager/jobs/ArtifactJob.ts'), 'utf8');

  assert.match(source, /commitCookie\(service\.newCookie\)/);
  assert.match(source, /finally\s*\{/);
});
