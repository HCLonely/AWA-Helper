(async () => {
  const fs = require('fs-extra');
  const path = require('path');
  // const zipdir = require('zip-dir');
  const { parse } = require('yaml');
  const { marked } = require('marked');
  const hljs = require('highlight.js');

  fs.writeFileSync('dist/awa-helper.js',
    fs.readFileSync('dist/awa-helper.js').toString().replace('__VERSION__', fs.readJSONSync('package.json').version));
  const fileList = [
    'config.example.yml',
    'CHANGELOG.txt',
    // 'dailyQuestDb.json',
    'package.json'
    // 'scripts/'
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
      return hljs.highlight(code, { language }).value;
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
    // eslint-disable-next-line max-len
    fs.writeFileSync(`dist/${e}.html`, `<style>${highlightCss}pre code.hljs{width:fit-content;}</style>${mainHtml}<script>${mermaidJs}</script><script>${highlightJs}</script><script>mermaid.initialize({startOnLoad:true});</script>`);
  });

  const locales = fs.readdirSync('src/locales');
  locales.map((e) => {
    const convertedText = parse(fs.readFileSync(path.join('src/locales', e)).toString());
    fs.ensureDirSync('dist/locales');
    fs.writeFileSync(path.join('dist/locales', e.replace('.yml', '.json')), JSON.stringify(convertedText, null, 2));
    return null;
  });

  fs.copySync('src/webUI', 'dist/webUI', { filter: (fileName) => !/\.ts$/.test(fileName) });
  fs.copySync('src/manager', 'dist/manager', { filter: (fileName) => !/\.ts$/.test(fileName) });
  // fs.copySync('configer/configer.template.yml.js', 'dist/configer.template.yml.js');
  if (!fs.existsSync('dist/config')) {
    fs.mkdirSync('dist/config');
  }
  if (!fs.existsSync('dist/logs')) {
    fs.mkdirSync('dist/logs');
  }
  fs.copySync('config.example.yml', 'dist/config/config.example.yml');

  fs.writeFileSync('dist/运行.bat', 'cd "%~dp0" && start cmd /k "node index.js"');
  fs.writeFileSync('dist/Run.bat', 'cd "%~dp0" && start cmd /k "node index.js"');
  fs.writeFileSync('dist/运行Manager.bat', 'cd "%~dp0" && start cmd /k "node manager/index.js"');
  fs.writeFileSync('dist/Run-Manager.bat', 'cd "%~dp0" && start cmd /k "node manager/index.js"');
  // eslint-disable-next-line max-len
  // fs.writeFileSync('dist/运行-auto.bat', 'cd "%~dp0" && where "powershell" && powershell -file "scripts/node_checker_cn.ps1" || where "pwsh" && pwsh -file "scripts/node_checker_cn.ps1" || .\\scripts\\node_checker_cn.bat && pause');
  // eslint-disable-next-line max-len
  // fs.writeFileSync('dist/Run-auto.bat', 'cd "%~dp0" && where "powershell" && powershell -file "scripts/node_checker.ps1" || where "pwsh" && pwsh -file "scripts/node_checker.ps1" || .\\scripts\\node_checker.bat && pause');
  // fs.writeFileSync('dist/run_auto_linux.sh', './scripts/node_checker.sh');
  // if (!process.argv.includes('--docker')) {
  //   await zipdir('dist', { saveTo: './AWA-Helper.zip' });
  //   /*
  //   if (!fs.existsSync('manager')) {
  //     fs.mkdirSync('manager');
  //   }
  //   fs.copySync('server', 'manager/server');
  //   fs.copySync('tools', 'manager/tools');
  //   fs.copySync('web', 'manager/web');
  //   fs.copySync('package.json', 'manager/package.json');
  //   await zipdir('manager', { saveTo: './AWA-Manager.zip' });
  //   */
  // }

  // fs.copySync('dist/webUI', 'output/webUI', { filter: (fileName) => !(/index\.js$/.test(fileName) && !fileName.includes('static')) });
  // fs.copySync('dist/manager', 'output/manager', { filter: (fileName) => !(/(index|tool)\.js$/.test(fileName) && !fileName.includes('static')) });
  // fs.copySync('dist/locales', 'output/locales');
  fs.copySync('dist/config', 'output/config');
  // fs.copySync('node_modules/@doctormckay/steam-crypto/system.pem', 'output/system.pem');
  // fs.copySync('dist/CHANGELOG.txt', 'output/CHANGELOG.txt');
  // fs.copySync('dist/dailyQuestDb.json', 'output/dailyQuestDb.json');
  fs.mkdirSync('output/logs');
  fs.copySync('dist/README.html', 'output/README.html');
  fs.copySync('dist/README_en.html', 'output/README_en.html');
  // windows
  fs.writeFileSync('output/AWA-Manager.bat', 'cd "%~dp0" && start cmd /k "AWA-Helper.exe --manager"');
  fs.writeFileSync('output/AWA-Helper.bat', 'cd "%~dp0" && start cmd /k "AWA-Helper.exe --helper"');
  fs.writeFileSync('output/update.bat', '@echo off\ncd "%~dp0"\ntaskkill /f /t /im AWA-Helper.exe\nstart cmd /k "AWA-Helper.exe --update"');
  // linux
  // fs.writeFileSync('output/AWA-Manager.sh', 'awapath=$(dirname $0)\ncd ${awapath}\n./AWA-Helper --manager');
  // fs.writeFileSync('output/AWA-Helper.sh', 'awapath=$(dirname $0)\ncd ${awapath}\n./AWA-Helper --helper');
  // fs.writeFileSync('output/update.sh', '@echo off\ncd "%~dp0"\ntaskkill /f /t /im AWA-Helper.exe\nstart cmd /k "AWA-Helper.exe --update"');
})();
