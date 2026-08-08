/** Architecture contracts for platform API ownership. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const sourceFiles = (directory) => fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
  const target = path.join(directory, entry.name);
  return entry.isDirectory() ? sourceFiles(target) : entry.name.endsWith('.ts') ? [target] : [];
});
const combinedSource = (relativeDirectory) => sourceFiles(path.join(root, relativeDirectory))
  .map((file) => fs.readFileSync(file, 'utf8')).join('\n');

test('Twitch client contains only Twitch remote requests', () => {
  const source = combinedSource('src/client/Twitch');
  assert.doesNotMatch(source, /alienwarearena\.com|globalThis\.awaHost|globalThis\.quest/);
  assert.match(source, /gql\.twitch\.tv/);
});

test('Steam client contains only ASF remote operations', () => {
  const source = combinedSource('src/client/Steam');
  assert.doesNotMatch(source, /alienwarearena\.com|globalThis\.awaHost|globalThis\.quest|\/steam\/quests/);
  assert.match(source, /\/Api\/Command/);
});

test('AWA owns Twitch tracking and Steam quest endpoints', () => {
  const source = combinedSource('src/client/AWA/APIs');
  assert.match(source, /\/twitch\/extensions\/track/);
  assert.match(source, /\/steam\/quests/);
  assert.match(source, /\/control-center/);
});

test('duplicate Achievement clients were removed', () => {
  assert.equal(fs.existsSync(path.join(root, 'src/client/AWA/AchievementAWAClient.ts')), false);
  assert.equal(fs.existsSync(path.join(root, 'src/client/Twitch/AchievementTwitchClient.ts')), false);
});

test('legacy AWAClient and global quest singleton were removed', () => {
  assert.equal(fs.existsSync(path.join(root, 'src/client/AWA/AWAClient.ts')), false);
  const source = combinedSource('src');
  assert.doesNotMatch(source, /globalThis\.quest/);
  assert.doesNotMatch(fs.readFileSync(path.join(root, 'src/global.d.ts'), 'utf8'), /var quest:/);
});
