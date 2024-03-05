const fs = require('fs');
const path = require('path');
const stream = require('stream');
const axios = require('axios');
const decompress = require('decompress');
const { promisify } = require('util');
const { execSync } = require('child_process');

(async () => {
  if (await downloadFile()) {
    if (!fs.existsSync('./resource_hacker/ResourceHacker.exe')) {
      console.log('Decompressing resource_hacker.zip ...');
      const decompressResult = await decompress('resource_hacker.zip', 'resource_hacker')
        .then(() => true)
        .catch((error) => {
          console.error(error);
          return false;
        });
      if (!decompressResult) {
        return;
      }
    }
    // eslint-disable-next-line max-len
    execSync(`${path.resolve('./resource_hacker/ResourceHacker')} -open "${path.resolve('output/AWA-helper-raw.exe')}" -save "${path.resolve('output/AWA-helper.exe')}" -action addoverwrite -res "${path.resolve('static/icon.ico')}" -mask ICONGROUP,1,1033`);
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
