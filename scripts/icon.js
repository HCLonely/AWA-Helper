const fs = require('fs');
const path = require('path');
const stream = require('stream');
const axios = require('axios');
const { promisify } = require('util');
const { execFileSync } = require('child_process');

(async () => {
  if (await downloadFile()) {
    if (!fs.existsSync('./resource_hacker/ResourceHacker.exe')) {
      console.log('Decompressing resource_hacker.zip ...');
      try {
        fs.mkdirSync('resource_hacker', { recursive: true });
        // Extract only the executable needed by the build. This prevents archive
        // entries from writing arbitrary paths outside the destination.
        execFileSync('tar', ['-xf', 'resource_hacker.zip', '-C', 'resource_hacker', 'ResourceHacker.exe']);
      } catch (error) {
        console.error(error);
        return;
      }
    }
    execFileSync(path.resolve('./resource_hacker/ResourceHacker.exe'), [
      '-open', path.resolve('output/AWA-Helper-raw.exe'),
      '-save', path.resolve('output/AWA-Helper.exe'),
      '-action', 'addoverwrite',
      '-res', path.resolve('static/icon.ico'),
      '-mask', 'ICONGROUP,1,1033'
    ]);
  }
})();

async function downloadFile() {
  if (fs.existsSync('resource_hacker.zip')) {
    return true;
  }
  console.log('Downloading resource_hacker.zip ...');
  const finished = promisify(stream.finished);
  const writer = fs.createWriteStream('resource_hacker.zip');
  return await axios.get('https://www.angusj.com/resourcehacker/resource_hacker.zip', {
    responseType: 'stream'
  })
    .then(async (response) => {
      response.data.pipe(writer);
      await finished(writer);
      return true;
    })
    .catch((error) => {
      console.error(error);
      writer.close();
      return;
    });
}
