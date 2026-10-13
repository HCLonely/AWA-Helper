/**
 * @file scripts/check-yaml.js
 * @description 使用项目已有的 YAML 解析器检查配置和语言文件。
 */
const fs = require('fs');
const path = require('path');
const {
  parseDocument
} = require('yaml');

const requestedFiles = process.argv.slice(2);
const files = requestedFiles.length ? requestedFiles : [
  'config.example.yml',
  ...fs.readdirSync('src/locales').filter((name) => name.endsWith('.yml'))
    .map((name) => path.join('src/locales', name))
];

for (const file of files) {
  try {
    const document = parseDocument(fs.readFileSync(file, 'utf8'));
    if (document.errors.length) {
      for (const error of document.errors) {
        console.error(`${file}: ${error.message}`);
      }
      process.exitCode = 1;
    }
  } catch (error) {
    console.error(`${file}: ${error.message}`);
    process.exitCode = 1;
  }
}
