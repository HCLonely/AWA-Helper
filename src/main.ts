/*
 * @Author       : HCLonely
 * @Date         : 2025-07-18 09:14:17
 * @LastEditTime : 2025-08-22 20:20:44
 * @LastEditors  : HCLonely
 * @FilePath     : /AWA-Helper/src/main.ts
 * @Description  : 启动文件
 */
import * as fs from 'fs';
import * as os from 'os';
import { startHelper } from './awa-helper';
import { startManager } from './manager/index';
// @ts-ignore
import exampleConfig from './config.example.yml';
import { runHealthcheck } from './core/process/healthcheck';

process.chdir(__dirname);

const createIfNotExists = (path: string, content?: string) => {
  if (!fs.existsSync(path)) {
    if (content) {
      fs.writeFileSync(path, content);
      if (path.endsWith('.sh')) {
        try {
          fs.chmodSync(path, 0o777);
        } catch (_e) {
          //
        }
      }
    } else {
      fs.mkdirSync(path);
    }
  }
};

const main = async (): Promise<void> => {
  if (process.argv.includes('--healthcheck')) {
    process.exit(await runHealthcheck() ? 0 : 1);
  }

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
    createIfNotExists('AWA-Manager.sh', isMainJs ? 'SCRIPT_DIR=$(cd $(dirname ${BASH_SOURCE[0]}); pwd)\ncd ${SCRIPT_DIR}\nnode main.js --manager' : 'SCRIPT_DIR=$(cd $(dirname ${BASH_SOURCE[0]}); pwd)\ncd ${SCRIPT_DIR}\nchmod +x ./AWA-Helper\n./AWA-Helper --manager');
    createIfNotExists('AWA-Helper.sh', isMainJs ? 'SCRIPT_DIR=$(cd $(dirname ${BASH_SOURCE[0]}); pwd)\ncd ${SCRIPT_DIR}\nnode main.js --helper' : 'SCRIPT_DIR=$(cd $(dirname ${BASH_SOURCE[0]}); pwd)\ncd ${SCRIPT_DIR}\nchmod +x ./AWA-Helper\n./AWA-Helper --helper');
    createIfNotExists('update.sh', isMainJs ? 'SCRIPT_DIR=$(cd $(dirname ${BASH_SOURCE[0]}); pwd)\ncd ${SCRIPT_DIR}\nnode main.js --update' : 'SCRIPT_DIR=$(cd $(dirname ${BASH_SOURCE[0]}); pwd)\ncd ${SCRIPT_DIR}\nkill -9 $(pidof AWA-Helper)\nchmod +x ./AWA-Helper\n./AWA-Helper --update');
  }

  if (process.argv.includes('--init')) return;
  if (process.argv.includes('--manager') || (process.argv.length === 2 && process.env.helperMode === 'manager')) {
    await startManager(process.argv.includes('--helper'));
    return;
  }
  await startHelper();
};

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
