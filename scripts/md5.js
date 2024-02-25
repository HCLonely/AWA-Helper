const fs = require('fs');
const crypto = require('crypto');

const mainJsText = fs.readFileSync('output/main.js').toString();
const hash = crypto.createHash('md5');
hash.update(mainJsText);
const md5 = hash.digest('hex');
fs.writeFileSync('output/md5.txt', md5);
