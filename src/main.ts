/*
 * @Author       : HCLonely
 * @Date         : 2025-07-18 09:14:17
 * @LastEditTime : 2025-08-22 20:20:44
 * @LastEditors  : HCLonely
 * @FilePath     : /AWA-Helper/src/main.ts
 * @Description  : 启动文件
 */
process.removeAllListeners('warning');
import * as fs from 'fs';
import * as os from 'os';
import { startHelper } from './awa-helper';
import { startManager } from './manager/index';
// @ts-ignore
import exampleConfig from './config.example.yml';

process.chdir(__dirname);

const createIfNotExists = (path: string, content?: string) => {
  if (!fs.existsSync(path)) {
    if (content) {
      fs.writeFileSync(path, content);
      if (path.endsWith('.sh')) {
        try {
          fs.chmodSync(path, 0o777);
        } catch (e) {
          //
        }
      }
    } else {
      fs.mkdirSync(path);
    }
  }
};

createIfNotExists('logs');
createIfNotExists('config');
createIfNotExists('config/config.example.yml', exampleConfig);

const isWindows = os.type() === 'Windows_NT';
const isMainJs = /.*main\.js$/.test(process.argv[1]);

if (isWindows) {
  createIfNotExists('AWA-Manager.bat', isMainJs ? 'cd "%~dp0" && start cmd /k "node main.js --manager"' : 'cd "%~dp0" && start cmd /k "AWA-Helper.exe --manager"');
  createIfNotExists('AWA-Helper.bat', isMainJs ? 'cd "%~dp0" && start cmd /k "node main.js --helper"' : 'cd "%~dp0" && start cmd /k "AWA-Helper.exe --helper"');
  createIfNotExists('update.bat', isMainJs ? 'cd "%~dp0" && start cmd /k "node main.js --update"' : '@echo off\ncd "%~dp0"\ntaskkill /f /t /im AWA-Helper.exe\nstart cmd /k "AWA-Helper.exe --update"');
} else {
  // eslint-disable-next-line max-len
  createIfNotExists('AWA-Manager.sh', isMainJs ? 'SCRIPT_DIR=$(cd $(dirname ${BASH_SOURCE[0]}); pwd)\ncd ${SCRIPT_DIR}\nnode main.js --manager' : 'SCRIPT_DIR=$(cd $(dirname ${BASH_SOURCE[0]}); pwd)\ncd ${SCRIPT_DIR}\nchmod +x ./AWA-Helper\n./AWA-Helper --manager');
  // eslint-disable-next-line max-len
  createIfNotExists('AWA-Helper.sh', isMainJs ? 'SCRIPT_DIR=$(cd $(dirname ${BASH_SOURCE[0]}); pwd)\ncd ${SCRIPT_DIR}\nnode main.js --helper' : 'SCRIPT_DIR=$(cd $(dirname ${BASH_SOURCE[0]}); pwd)\ncd ${SCRIPT_DIR}\nchmod +x ./AWA-Helper\n./AWA-Helper --helper');
  // eslint-disable-next-line max-len
  createIfNotExists('update.sh', isMainJs ? 'SCRIPT_DIR=$(cd $(dirname ${BASH_SOURCE[0]}); pwd)\ncd ${SCRIPT_DIR}\nnode main.js --update' : 'SCRIPT_DIR=$(cd $(dirname ${BASH_SOURCE[0]}); pwd)\ncd ${SCRIPT_DIR}\nkill -9 $(pidof AWA-Helper)\nchmod +x ./AWA-Helper\n./AWA-Helper --update');
}

if (process.argv.includes('--init')) {
  process.exit(0);
} else if (process.argv.includes('--manager') || (process.argv.length === 2 && process.env.helperMode === 'manager')) {
  startManager(process.argv.includes('--helper'));
} else {
  startHelper();
}
