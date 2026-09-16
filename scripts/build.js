/**
 * @file scripts/build.js
 * @description 整理构建资源，生成平台启动脚本及输出目录。
 */
(async () => {
  const fs = require('fs-extra');
  const path = require('path');

  const {
    parse
  } = require('yaml');
  const {
    marked
  } = await import('marked');
  const hljs = require('highlight.js');

  fs.writeFileSync('dist/index.js',
    fs.readFileSync('dist/index.js').toString().replace('__VERSION__', fs.readJSONSync('package.json').version));
  const fileList = [
    'config.example.yml',
    'CHANGELOG.txt',
    'package.json'
  ];
  fileList.forEach((e) => {
    fs.copySync(e, `dist/${e}`);
  });

  const readmeFileList = [
    'README',
    'README_en'
  ];

  marked.setOptions({
    renderer: new marked.Renderer(),
    highlight(code, lang) {
      if (lang === 'mermaid') {
        return `<div class="mermaid">\n${code}\n</div>`;
      }
      const language = hljs.getLanguage(lang) ? lang : 'plaintext';
      return hljs.highlight(code, {
        language
      }).value;
    },
    langPrefix: 'hljs language-',
    pedantic: false,
    gfm: true,
    breaks: false,
    sanitize: false,
    smartLists: true,
    smartypants: false,
    xhtml: false
  });
  readmeFileList.forEach((e) => {
    const mainHtml = marked.parse(fs.readFileSync(`${e}.md`).toString().replace(/\/(README.*?)\.md/g, '$1.html'));
    const mermaidJs = fs.readFileSync('static/mermaid.min.js').toString();
    const highlightCss = fs.readFileSync('static/github-dark-dimmed.css').toString();
    const highlightJs = fs.readFileSync('static/highlight.min.js').toString();
    fs.writeFileSync(`dist/${e}.html`, `<style>${highlightCss}pre code.hljs{width:fit-content;}</style>${mainHtml}<script>${mermaidJs}</script><script>${highlightJs}</script><script>mermaid.initialize({startOnLoad:true});</script>`);
  });

  const locales = fs.readdirSync('src/locales');
  locales.map((e) => {
    const convertedText = parse(fs.readFileSync(path.join('src/locales', e)).toString());
    fs.ensureDirSync('dist/locales');
    fs.writeFileSync(path.join('dist/locales', e.replace('.yml', '.json')), JSON.stringify(convertedText, null, 2));
    return null;
  });

  fs.copySync('src/webUI', 'dist/webUI', {
    filter: (fileName) => !/\.ts$/.test(fileName)
  });
  fs.writeFileSync('dist/webUI/static/templates/config.zh.yml',
    fs.readFileSync('dist/webUI/static/templates/config.zh.yml').toString().replace('__VERSION__', fs.readJSONSync('package.json').version));
  fs.writeFileSync('dist/webUI/static/templates/config.en.yml',
    fs.readFileSync('dist/webUI/static/templates/config.en.yml').toString().replace('__VERSION__', fs.readJSONSync('package.json').version));
  if (!fs.existsSync('dist/config')) {
    fs.mkdirSync('dist/config');
  }
  if (!fs.existsSync('dist/logs')) {
    fs.mkdirSync('dist/logs');
  }
  fs.copySync('config.example.yml', 'dist/config/config.example.yml');

  fs.copySync('dist/config', 'output/config');
  fs.mkdirSync('output/logs', {
    recursive: true
  });
  fs.copySync('dist/README.html', 'output/README.html');
  fs.copySync('dist/README_en.html', 'output/README_en.html');
  // 生成 Windows 启动脚本。
  fs.writeFileSync('output/AWA-Manager.bat', 'cd "%~dp0" && start cmd /k "AWA-Helper.exe --manager"');
  fs.writeFileSync('output/AWA-DailyQuest.bat', 'cd "%~dp0" && start cmd /k "AWA-Helper.exe --daily"');
  fs.writeFileSync('output/update.bat', '@echo off\r\ncd /d "%~dp0"\r\nif exist "AWA-Manager.exe" (\r\n  start "" "AWA-Manager.exe" --check-update\r\n) else (\r\n  "AWA-Helper.exe" --update\r\n)\r\n');
  // 生成 Linux 启动脚本。

  // 每日任务使用 --daily；--helper 仅保留为已弃用的运行时别名。

})();
