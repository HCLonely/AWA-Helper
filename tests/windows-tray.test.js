/** @description Guards the additive Windows tray packaging contract. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const { parseTrayCommand } = require('../dist/tools/process/TrayBridge');

test('Windows tray entry is additive and preserves legacy launchers', () => {
  const buildScript = fs.readFileSync(path.join(root, 'scripts', 'build.js'), 'utf8');
  assert.match(buildScript, /AWA-Manager\.bat.*AWA-Helper\.exe --manager/);
  assert.match(buildScript, /AWA-DailyQuest\.bat.*AWA-Helper\.exe --daily/);

  const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  assert.match(packageJson.scripts['pack:win'], /build-tray\.js/);
  assert.ok(fs.existsSync(path.join(root, 'native', 'windows-tray', 'AWA-Manager.cpp')));
  assert.ok(fs.existsSync(path.join(root, 'native', 'windows-tray', 'AWA-Manager.vcxproj')));
});

test('tray control commands map to Manager operations', () => {
  assert.equal(parseTrayCommand('start-helper'), 'startHelper');
  assert.equal(parseTrayCommand('stop-helper'), 'stopHelper');
  assert.equal(parseTrayCommand('start-achievement'), 'startAchievement');
  assert.equal(parseTrayCommand('stop-achievement'), 'stopAchievement');
  assert.equal(parseTrayCommand('shutdown'), 'shutdown');
  assert.equal(parseTrayCommand('unknown'), undefined);
});

test('tray source and workflows expose status controls and package the executable', () => {
  const nativeSource = fs.readFileSync(path.join(root, 'native', 'windows-tray', 'AWA-Manager.cpp'), 'utf8');
  for (const text of ['查看运行状态', '启动Helper', '停止Helper', '启动Achievement', '停止Achievement', '退出AWA-Manager']) {
    assert.ok(nativeSource.includes(text));
  }
  assert.match(nativeSource, /NIF_TIP \| NIF_SHOWTIP/);
  const releaseWorkflow = fs.readFileSync(path.join(root, '.github', 'workflows', 'Release.yml'), 'utf8');
  const testWorkflow = fs.readFileSync(path.join(root, '.github', 'workflows', 'Test.yml'), 'utf8');
  assert.match(releaseWorkflow, /Verify Windows tray artifacts/);
  assert.match(testWorkflow, /Compile Windows tray app/);
});
