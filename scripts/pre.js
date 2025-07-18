const fs = require('fs-extra');

fs.emptyDirSync('dist');
fs.emptyDirSync('output');
fs.copyFileSync('config.example.yml', 'src/config.example.yml');
