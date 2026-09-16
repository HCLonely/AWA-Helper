/**
 * @file scripts/md5.js
 * @description 计算构建产物的 MD5 校验值。
 */
const fs = require('fs');
const crypto = require('crypto');

const mainJsText = fs.readFileSync('output/index.js').toString();
const hash = crypto.createHash('sha256');
hash.update(mainJsText);
const sha256 = hash.digest('hex');
fs.writeFileSync('output/sha256.txt', sha256);
