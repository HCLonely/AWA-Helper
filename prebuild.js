const fs = require('fs-extra');
const path = require('path');

const dependencies = Object.keys(require('./package.json').dependencies);

const replaceDir = (dir) => {
  fs.writeFileSync(dir, fs.readFileSync(dir).toString().replace('__dirname', 'process.cwd()'));
  // fs.writeFileSync(dir, fs.readFileSync(dir).toString().replace('process.cwd()', '__dirname'));
};

const findFile = (dir) => {
  const items = fs.readdirSync(dir);
  for (const item of items) {
    const itemPath = path.join(dir, item);
    if (fs.statSync(itemPath).isDirectory()) {
      findFile(itemPath);
    } else if (fs.statSync(itemPath).isFile()) {
      replaceDir(itemPath);
    }
  }
};

for (const dependenciesName of dependencies) {
  findFile(path.join('node_modules', dependenciesName));
}

const assets = [
  ['node_modules/@doctormckay/steam-crypto/system.pem', 'output/system.pem'],
  ['node_modules/lzma/src/lzma_worker.js', 'output/src/lzma_worker.js']
];

for (const asset of assets) {
  fs.ensureDirSync(path.join(asset[1], '../'));
  fs.copyFileSync(asset[0], asset[1]);
}
