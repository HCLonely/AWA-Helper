(async () => {
  const fs = require('fs-extra');
  const zipdir = require('zip-dir');

  if (process.argv.includes('--pre')) {
    fs.writeFileSync('dist/index.js', fs.readFileSync('dist/index.js').toString().replace('__VERSION__', fs.readJSONSync('package.json').version));
    return;
  }
  fs.copyFileSync('config.example.yml', 'dist/config.example.yml');
  fs.copyFileSync('CHANGELOG.txt', 'dist/CHANGELOG.txt');
  fs.copyFileSync('CHANGELOG.txt', 'output/CHANGELOG.txt');
  fs.copyFileSync('config.example.yml', 'output/config.example.yml');
  fs.writeFileSync('output/运行.bat', 'start cmd /k "AWA-Helper.exe"');
  await zipdir('output', { saveTo: './AWA-Helper.zip' });
})();
