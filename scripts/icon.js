/**
 * @file scripts/icon.js
 * @description 下载资源工具并为 Windows 可执行文件设置图标。
 */
const fs = require('fs');
const path = require('path');
const {
  pipeline
} = require('stream/promises');
const axios = require('axios');
const {
  execFileSync
} = require('child_process');

async function applyIcon() {
  const executable = path.resolve('resource_hacker/ResourceHacker.exe');
  if (!fs.existsSync(executable)) {
    await downloadFile();
    fs.mkdirSync('resource_hacker', {
      recursive: true
    });
    // 仅提取可执行文件，避免解压任意归档路径。
    execFileSync('tar', ['-xf', 'resource_hacker.zip', '-C', 'resource_hacker', 'ResourceHacker.exe']);
  }
  const output = path.resolve('output/AWA-Helper.exe');
  fs.rmSync(output, {
    force: true
  });
  execFileSync(executable, [
    '-open', path.resolve('output/AWA-Helper-raw.exe'), '-save', output,
    '-action', 'addoverwrite', '-res', path.resolve('static/icon.ico'), '-mask', 'ICONGROUP,1,1033'
  ]);
  if (!fs.existsSync(output) || fs.statSync(output).size === 0) {
    throw new Error('Resource Hacker did not produce AWA-Helper.exe');
  }
}

async function downloadFile() {
  if (fs.existsSync('resource_hacker.zip') && fs.statSync('resource_hacker.zip').size > 0) { return; }
  console.log('Downloading resource_hacker.zip ...');
  const temporary = 'resource_hacker.zip.download';
  try {
    const response = await axios.get('https://www.angusj.com/resourcehacker/resource_hacker.zip', {
      responseType: 'stream',
      timeout: 30000
    });
    await pipeline(response.data, fs.createWriteStream(temporary));
    fs.renameSync(temporary, 'resource_hacker.zip');
  } finally { fs.rmSync(temporary, {
    force: true
  }); }
}

if (require.main === module) {
  applyIcon().catch(error => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
module.exports = {
  applyIcon
};
