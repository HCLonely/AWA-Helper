const fs = require('fs');
const crypto = require('crypto');

const mainJsText = fs.readFileSync('output/main.js').toString();
const hash = crypto.createHash('sha256');
hash.update(mainJsText);
const sha256 = hash.digest('hex');
fs.writeFileSync('output/sha256.txt', sha256);
