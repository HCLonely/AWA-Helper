(async () => {
  const fs = require('fs-extra');
  const zipdir = require('zip-dir');

  fs.writeFileSync('dist/index.js', fs.readFileSync('dist/index.js').toString().replace('__VERSION__', fs.readJSONSync('package.json').version));

  if (!process.argv.includes('--test')) {
    fs.copyFileSync('config.example.yml', 'output/config.example.yml');
    fs.writeFileSync('output/运行.bat', 'start cmd /k "AWA-Helper.exe"');
    await zipdir('output', { saveTo: './AWA-Helper.zip' });
  }
})();
