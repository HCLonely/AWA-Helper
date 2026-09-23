/**
 * @file scripts/pre.js
 * @description 准备打包所需的版本与构建配置。
 */
const fs = require('fs-extra');

fs.emptyDirSync('dist');
fs.emptyDirSync('output');
fs.copyFileSync('config.example.yml', 'src/config.example.yml');
