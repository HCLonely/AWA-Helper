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

test('platform clients use injected context and do not read mutable application globals', () => {
  const source = [
    combinedSource('src/client/AWA'),
    combinedSource('src/client/Twitch'),
    combinedSource('src/client/Steam'),
    combinedSource('src/client/shared')
  ].join('\n');
  assert.doesNotMatch(source, /globalThis\.(quest|awaHost|userAgent)/);
  assert.doesNotMatch(source, /tools-path/);
  assert.match(source, /interface HttpTransport/);
  assert.doesNotMatch(source, /from ['"][^'"]*(?:core|server)\//);
});

test('Steam quest preparation belongs to Core and not AWA API modules', () => {
  const awaSource = combinedSource('src/client/AWA/APIs');
  const coreSource = combinedSource('src/core/DailyQuest');
  assert.doesNotMatch(awaSource, /prepareQuest\s*\(/);
  assert.match(coreSource, /prepareQuest\s*\(/);
});

test('Achievement tracking remains awaited and abort-aware under Manager', () => {
  const source = fs.readFileSync(path.join(root, 'src/core/Achievement/AchievementService.ts'), 'utf8');
  assert.match(source, /await this\.watchTwitch\(signal\)/);
  assert.match(source, /sleep\(60, signal\)/);
  assert.doesNotMatch(source, /return this\.watchTwitch\(/);
});
