(async () => {
  const fs = require('fs-extra');
  const zipdir = require('zip-dir');

  fs.copyFileSync('config.example.yml', 'output/config.example.yml');
  fs.writeFileSync('output/运行.bat', 'start cmd /k "AWA-Helper.exe"');
  await zipdir('output', { saveTo: './AWA-Helper.zip' });
})();
