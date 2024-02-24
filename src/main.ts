process.removeAllListeners('warning');
import * as fs from 'fs';
import * as os from 'os';
import { startHelper } from './awa-helper';
import { startManager } from './manager/index';
// @ts-ignore
import exampleConfig from 'config.example.yml';

if (!fs.existsSync('logs')) {
  fs.mkdirSync('logs');
}

if (!fs.existsSync('config')) {
  fs.mkdirSync('config');
}
if (!fs.existsSync('config/config.example.yml')) {
  fs.writeFileSync('config/config.example.yml', exampleConfig);
}
if (os.type() === 'Windows_NT') {
  if (!fs.existsSync('AWA-Manager.bat')) {
    fs.writeFileSync('AWA-Manager.bat', 'cd "%~dp0" && start cmd /k "AWA-Helper.exe --manager"');
  }
  if (!fs.existsSync('AWA-Helper.bat')) {
    fs.writeFileSync('AWA-Helper.bat', 'cd "%~dp0" && start cmd /k "AWA-Helper.exe --helper"');
  }
  if (!fs.existsSync('update.bat')) {
    fs.writeFileSync('output/update.bat', '@echo off\ncd "%~dp0"\ntaskkill /f /t /im AWA-Helper.exe\nstart cmd /k "AWA-Helper.exe --update"');
  }
} else {
  if (!fs.existsSync('AWA-Manager.sh')) {
    // eslint-disable-next-line max-len
    fs.writeFileSync('AWA-Manager.sh', 'SCRIPT_DIR=$(cd $(dirname ${BASH_SOURCE[0]}); pwd)\ncd ${SCRIPT_DIR}\nchmod +x ./AWA-Helper\n./AWA-Helper --manager');
  }
  if (!fs.existsSync('AWA-Helper.sh')) {
    // eslint-disable-next-line max-len
    fs.writeFileSync('AWA-Helper.sh', 'SCRIPT_DIR=$(cd $(dirname ${BASH_SOURCE[0]}); pwd)\ncd ${SCRIPT_DIR}\nchmod +x ./AWA-Helper\n./AWA-Helper --helper');
  }
  if (!fs.existsSync('update.sh')) {
    // eslint-disable-next-line max-len
    fs.writeFileSync('update.sh', 'SCRIPT_DIR=$(cd $(dirname ${BASH_SOURCE[0]}); pwd)\ncd ${SCRIPT_DIR}\nkill -9 $(pidof AWA-Helper)\nchmod +x ./AWA-Helper\n./AWA-Helper --update');
  }
}

if (process.argv.includes('--manager') || (process.argv.length === 2 && process.env.helperMode === 'manager')) {
  startManager(process.argv.includes('--helper'));
} else {
  startHelper();
}
