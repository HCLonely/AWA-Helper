process.removeAllListeners('warning');
import * as fs from 'fs';
import * as os from 'os';
import { startHelper } from './awa-helper';
import { startManager } from './manager/index';
// @ts-ignore
import exampleConfig from './config.example.yml';

process.chdir(__dirname);

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
    if (/.*main\.js$/.test(process.argv[1])) {
      fs.writeFileSync('AWA-Manager.bat', 'cd "%~dp0" && start cmd /k "node main.js --manager"');
    } else {
      fs.writeFileSync('AWA-Manager.bat', 'cd "%~dp0" && start cmd /k "AWA-Helper.exe --manager"');
    }
  }
  if (!fs.existsSync('AWA-Helper.bat')) {
    if (/.*main\.js$/.test(process.argv[1])) {
      fs.writeFileSync('AWA-Helper.bat', 'cd "%~dp0" && start cmd /k "node main.js --helper"');
    } else {
      fs.writeFileSync('AWA-Helper.bat', 'cd "%~dp0" && start cmd /k "AWA-Helper.exe --helper"');
    }
  }
  if (!fs.existsSync('update.bat')) {
    if (/.*main\.js$/.test(process.argv[1])) {
      fs.writeFileSync('update.bat', 'cd "%~dp0" && start cmd /k "node main.js --update"');
    } else {
      fs.writeFileSync('update.bat', '@echo off\ncd "%~dp0"\ntaskkill /f /t /im AWA-Helper.exe\nstart cmd /k "AWA-Helper.exe --update"');
    }
  }
} else {
  if (!fs.existsSync('AWA-Manager.sh')) {
    if (/.*main\.js$/.test(process.argv[1])) {
      fs.writeFileSync('AWA-Manager.sh', 'SCRIPT_DIR=$(cd $(dirname ${BASH_SOURCE[0]}); pwd)\ncd ${SCRIPT_DIR}\nnode main.js --manager');
    } else {
      // eslint-disable-next-line max-len
      fs.writeFileSync('AWA-Manager.sh', 'SCRIPT_DIR=$(cd $(dirname ${BASH_SOURCE[0]}); pwd)\ncd ${SCRIPT_DIR}\nchmod +x ./AWA-Helper\n./AWA-Helper --manager');
    }
    try {
      fs.chmodSync('AWA-Manager.sh', 0o777);
    } catch (e) {
      //
    }
  }
  if (!fs.existsSync('AWA-Helper.sh')) {
    if (/.*main\.js$/.test(process.argv[1])) {
      fs.writeFileSync('AWA-Helper.sh', 'SCRIPT_DIR=$(cd $(dirname ${BASH_SOURCE[0]}); pwd)\ncd ${SCRIPT_DIR}\nnode main.js --helper');
    } else {
      // eslint-disable-next-line max-len
      fs.writeFileSync('AWA-Helper.sh', 'SCRIPT_DIR=$(cd $(dirname ${BASH_SOURCE[0]}); pwd)\ncd ${SCRIPT_DIR}\nchmod +x ./AWA-Helper\n./AWA-Helper --helper');
    }
    try {
      fs.chmodSync('AWA-Helper.sh', 0o777);
    } catch (e) {
      //
    }
  }
  if (!fs.existsSync('update.sh')) {
    if (/.*main\.js$/.test(process.argv[1])) {
      fs.writeFileSync('update.sh', 'SCRIPT_DIR=$(cd $(dirname ${BASH_SOURCE[0]}); pwd)\ncd ${SCRIPT_DIR}\nnode main.js --update');
    } else {
      // eslint-disable-next-line max-len
      fs.writeFileSync('update.sh', 'SCRIPT_DIR=$(cd $(dirname ${BASH_SOURCE[0]}); pwd)\ncd ${SCRIPT_DIR}\nkill -9 $(pidof AWA-Helper)\nchmod +x ./AWA-Helper\n./AWA-Helper --update');
    }
    try {
      fs.chmodSync('update.sh', 0o777);
    } catch (e) {
      //
    }
  }
}

if (process.argv.includes('--init')) {
  process.exit(0);
} else if (process.argv.includes('--manager') || (process.argv.length === 2 && process.env.helperMode === 'manager')) {
  startManager(process.argv.includes('--helper'));
} else {
  startHelper();
}
