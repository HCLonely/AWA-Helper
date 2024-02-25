const fs = require('fs');

fs.unlinkSync('output/AWA-Helper.exe');
fs.unlinkSync('output/AWA-Helper.bat');
fs.unlinkSync('output/AWA-Manager.bat');
fs.unlinkSync('output/update.bat');

// eslint-disable-next-line max-len
fs.writeFileSync('output/AWA-Manager.sh', 'SCRIPT_DIR=$(cd $(dirname ${BASH_SOURCE[0]}); pwd)\ncd ${SCRIPT_DIR}\nchmod +x ./AWA-Helper\n./AWA-Helper --manager');
// eslint-disable-next-line max-len
fs.writeFileSync('output/AWA-Helper.sh', 'SCRIPT_DIR=$(cd $(dirname ${BASH_SOURCE[0]}); pwd)\ncd ${SCRIPT_DIR}\nchmod +x ./AWA-Helper\n./AWA-Helper --helper');
// eslint-disable-next-line max-len
fs.writeFileSync('output/update.sh', 'SCRIPT_DIR=$(cd $(dirname ${BASH_SOURCE[0]}); pwd)\ncd ${SCRIPT_DIR}\nkill -9 $(pidof AWA-Helper)\nchmod +x ./AWA-Helper\n./AWA-Helper --update');
