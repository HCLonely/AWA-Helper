const fs = require('fs-extra');

/*
fs.writeFileSync('node_modules/lzma/index.js', `//! © 2015 Nathan Rugg <nmrugg@gmail.com> | MIT

var lzmaWoker = require("./src/lzma_worker.js");
var lzma = lzmaWoker.LZMA_WORKER;

///NOTE: This function is for backwards compatibility's sake.
module.exports.LZMA = function LZMA()
{
    return lzma;
}

module.exports.compress   = lzma.compress;
module.exports.decompress = lzma.decompress;
`);

const lzma = fs.readFileSync('node_modules/lzma/src/lzma_worker.js').toString();
if (!lzma.includes('module.exports = { LZMA_WORKER: LZMA };')) {
  fs.writeFileSync('node_modules/lzma/src/lzma_worker.js', `${lzma}\nmodule.exports = { LZMA_WORKER: LZMA };\n\n`);
}
*/
fs.emptyDirSync('dist');
fs.emptyDirSync('output');
fs.copyFileSync('config.example.yml', 'src/config.example.yml');
