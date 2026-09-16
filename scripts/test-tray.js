/** Native archive tests use constructed tar records, never an external network. */
const fs = require('fs');
const path = require('path');
const assert = require('assert/strict');
const { gzipSync } = require('zlib');
const { createHash } = require('crypto');
const { execFileSync, spawnSync } = require('child_process');

execFileSync(process.execPath, ['scripts/build-tray.js', '--test'], { stdio: 'inherit' });
const directory = fs.mkdtempSync(path.resolve('native/windows-tray/obj/archive-tests-'));
const executable = path.resolve('output/AWA-Updater-tests.exe');
const entry = (name, contents = '', type = '0') => {
  const data = Buffer.from(contents);
  const header = Buffer.alloc(512);
  header.write(name, 0, 100);
  header.write('0000644\0', 100);
  header.write(`${data.length.toString(8).padStart(11, '0')}\0`, 124);
  header.fill(32, 148, 156);
  header.write(type, 156);
  header.write('ustar\0', 257);
  const sum = header.reduce((total, byte) => total + byte, 0);
  header.write(`${sum.toString(8).padStart(6, '0')}\0 `, 148);
  return Buffer.concat([header, data, Buffer.alloc((512 - data.length % 512) % 512)]);
};
const cases = [
  ['valid', [entry('./output/', '', '5'), entry('./output/AWA-Helper.exe', 'helper'), entry('./output/config/config.yml', 'must-not-extract')], true],
  ['traversal', [entry('./output/../escape.exe', 'bad')], false],
  ['absolute', [entry('/output/AWA-Helper.exe', 'bad')], false],
  ['ads', [entry('./output/AWA-Helper.exe:stream', 'bad')], false],
  ['link', [entry('./output/AWA-Helper.exe', '', '2')], false],
  ['hardlink', [entry('./output/AWA-Helper.exe', '', '1')], false],
  ['pax', [entry('./output/PaxHeader', 'path=../escape', 'x')], false],
  ['duplicate', [entry('./output/AWA-Helper.exe', 'one'), entry('./output/awa-helper.exe', 'two')], false],
  ['wrong-root', [entry('./payload/AWA-Helper.exe', 'bad')], false]
];
try {
  for (const [name, entries, valid] of cases) {
    const archive = path.join(directory, `${name}.tar.gz`);
    const output = path.join(directory, name);
    fs.writeFileSync(archive, gzipSync(Buffer.concat([...entries, Buffer.alloc(1024)])));
    const result = spawnSync(executable, ['--extract', archive, output], { encoding: 'utf8' });
    assert.equal(result.status, valid ? 0 : 1, `${name}: ${result.stderr}`);
    if (valid) {
      assert.equal(fs.readFileSync(path.join(output, 'AWA-Helper.exe'), 'utf8'), 'helper');
      assert.equal(fs.existsSync(path.join(output, 'config/config.yml')), false);
    }
  }
  const corrupt = gzipSync(Buffer.concat([entry('./output/AWA-Helper.exe', 'helper'), Buffer.alloc(1024)]));
  corrupt[corrupt.length - 8] ^= 0xff;
  const archive = path.join(directory, 'corrupt.tar.gz');
  fs.writeFileSync(archive, corrupt);
  assert.equal(spawnSync(executable, ['--extract', archive, path.join(directory, 'corrupt')]).status, 1);
  console.log('PASS native gzip/tar validation, traversal, links, duplicate paths, CRC and user-data exclusion');
  const files = [
    ['AWA-Manager.exe', fs.readFileSync(executable)],
    ['AWA-Helper.exe', Buffer.from('fixture Helper')],
    ['config/config.example.yml', Buffer.from('language: zh\n')]
  ];
  const manifest = {
    schema: 1,
    version: '9.1.0',
    files: files.map(([name, data]) => ({ path: name, size: data.length, required: true, sha256: createHash('sha256').update(data).digest('hex') }))
  };
  const packageFile = path.join(directory, 'package.tar.gz');
  fs.writeFileSync(packageFile, gzipSync(Buffer.concat([
    ...files.map(([name, data]) => entry(`./output/${name}`, data)),
    entry('./output/installation.json', JSON.stringify(manifest)), Buffer.alloc(1024)
  ])));
  for (const mode of ['bootstrap', 'repair', 'upgrade', 'current', 'newer', 'checksum']) {
    const result = spawnSync(executable, ['--prepare', path.join(directory, mode), packageFile, mode], { encoding: 'utf8' });
    assert.equal(result.status, 0, `${mode}: ${result.stderr}`);
  }
  console.log('PASS bootstrap, same-version repair, upgrade, no update, no downgrade and checksum-file fallback');
} finally {
  fs.rmSync(directory, { recursive: true, force: true });
}
