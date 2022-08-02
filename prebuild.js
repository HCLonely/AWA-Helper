const fs = require('fs-extra');
const path = require('path');

const dependencies = Object.keys(require('./package.json').dependencies);

const replaceDir = (dir) => {
  fs.writeFileSync(dir, fs.readFileSync(dir).toString().replace(/__dirname/g, 'process.cwd()'));
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
  ['node_modules/@doctormckay/steam-crypto/system.pem', 'output/system.pem', 'dist/system.pem'],
  ['node_modules/lzma/src/lzma_worker.js', 'output/src/lzma_worker.js', 'dist/src/lzma_worker.js']
];

for (const asset of assets) {
  fs.ensureDirSync(path.join(asset[1], '../'));
  fs.copyFileSync(asset[0], asset[1]);
  fs.ensureDirSync(path.join(asset[2], '../'));
  fs.copyFileSync(asset[0], asset[2]);
}

const rollup = require('rollup');
const nodeModulesDir = 'node_modules';
const names = ['@messageformat/date-skeleton', '@messageformat/number-skeleton'];

names.map(async (e) => {
  const packageJson = JSON.parse(fs.readFileSync(path.join(nodeModulesDir, e, 'package.json')).toString());
  const mainFile = packageJson.main;
  if (/.*?\.bundle\.js/.test(mainFile)) {
    return null;
  }
  packageJson.main = packageJson.main.replace('index.js', 'index.bundle.js');
  packageJson.type = 'commonjs';
  fs.writeFileSync(path.join(nodeModulesDir, e, 'package.json'), JSON.stringify(packageJson, null, 2));
  const options = {
    input: path.join(nodeModulesDir, e, mainFile),
    output: {
      file: path.join(nodeModulesDir, e, mainFile.replace('index.js', 'index.bundle.js')),
      format: 'cjs'
    }
  };
  await rollup.rollup(options).write(options);
});
