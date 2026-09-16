/** Build a deterministic, program-only Windows package and its integrity manifest. */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const files = [
  'AWA-Manager.exe', 'AWA-Helper.exe', 'AWA-Manager.bat', 'AWA-DailyQuest.bat',
  'update.bat', 'README.html', 'README_en.html', 'config/config.example.yml',
  'healthcheck.js', 'THIRD-PARTY-NOTICES.txt'
];
const digest = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const notices = ['json.LICENSE', 'miniz.LICENSE'].map((name) => fs.readFileSync(path.join('native/windows-tray/vendor', name), 'utf8')).join('\n\n');
fs.writeFileSync('output/THIRD-PARTY-NOTICES.txt', notices);
const manifest = {
  schema: 1,
  version: require('../package.json').version,
  files: files.map((name) => ({
    path: name,
    required: ['AWA-Manager.exe', 'AWA-Helper.exe', 'config/config.example.yml'].includes(name),
    size: fs.statSync(path.join('output', name)).size,
    sha256: digest(path.join('output', name))
  }))
};
fs.writeFileSync('output/installation.json', JSON.stringify(manifest, null, 2));
// Explicit file list excludes local configuration, cookies, logs and runtime data.
// ustar avoids platform-dependent PAX extension headers in the bootstrap parser.
execFileSync('tar', ['--format=ustar', '-zcf', 'AWA-Helper-Win.tar.gz', ...[...files, 'installation.json'].map((name) => `./output/${name}`)], { stdio: 'inherit' });
fs.writeFileSync('AWA-Helper-Win.tar.gz.sha256', `${digest('AWA-Helper-Win.tar.gz')}  AWA-Helper-Win.tar.gz\n`);
