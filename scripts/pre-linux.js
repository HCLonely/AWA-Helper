/**
 * @file scripts/pre-linux.js
 * @description 准备 Linux 发布所需的目录和文件。
 */
const fs = require('fs');

fs.rmSync('output/AWA-Helper.exe', {
  force: true
});
fs.rmSync('output/AWA-DailyQuest.bat', {
  force: true
});
fs.rmSync('output/AWA-Manager.bat', {
  force: true
});
fs.rmSync('output/update.bat', {
  force: true
});

fs.writeFileSync('output/AWA-Manager.sh', 'SCRIPT_DIR=$(cd $(dirname ${BASH_SOURCE[0]}); pwd)\ncd ${SCRIPT_DIR}\nchmod +x ./AWA-Helper\n./AWA-Helper --manager');
fs.writeFileSync('output/AWA-DailyQuest.sh', 'SCRIPT_DIR=$(cd $(dirname ${BASH_SOURCE[0]}); pwd)\ncd ${SCRIPT_DIR}\nchmod +x ./AWA-Helper\n./AWA-Helper --daily');
fs.writeFileSync('output/update.sh', 'SCRIPT_DIR=$(cd $(dirname ${BASH_SOURCE[0]}); pwd)\ncd ${SCRIPT_DIR}\nkill -9 $(pidof AWA-Helper)\nchmod +x ./AWA-Helper\n./AWA-Helper --update');
