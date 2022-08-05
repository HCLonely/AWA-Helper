(async () => {
  const fs = require('fs-extra');
  const path = require('path');
  const zipdir = require('zip-dir');
  const { parse } = require('yaml');

  if (process.argv.includes('--pre')) {
    fs.writeFileSync('dist/index.js', fs.readFileSync('dist/index.js').toString().replace('__VERSION__', fs.readJSONSync('package.json').version));
    return;
  }
  fs.copyFileSync('config.example.yml', 'dist/config.example.yml');
  fs.copyFileSync('CHANGELOG.txt', 'dist/CHANGELOG.txt');
  fs.copyFileSync('dailyQuestDb.json', 'dist/dailyQuestDb.json');

  const locales = fs.readdirSync('src/locales');
  locales.map((e) => {
    const convertedText = parse(fs.readFileSync(path.join('src/locales', e)).toString());
    fs.ensureDirSync('dist/locales');
    fs.writeFileSync(path.join('dist/locales', e.replace('.yml', '.json')), JSON.stringify(convertedText, null, 2));
    if (process.argv.includes('--compile')) {
      fs.ensureDirSync('output/locales');
      fs.writeFileSync(path.join('output/locales', e.replace('.yml', '.json')), JSON.stringify(convertedText, null, 2));
    }
    return null;
  });

  if (process.argv.includes('--compile')) {
    fs.copyFileSync('CHANGELOG.txt', 'output/CHANGELOG.txt');
    fs.copyFileSync('config.example.yml', 'output/config.example.yml');
    fs.copyFileSync('dailyQuestDb.json', 'output/dailyQuestDb.json');
    fs.writeFileSync('output/运行.bat', 'start cmd /k "AWA-Helper.exe"');
    await zipdir('output', { saveTo: './AWA-Helper.zip' });
  }
})();
