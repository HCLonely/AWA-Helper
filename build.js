(async () => {
  const fs = require('fs-extra');
  const path = require('path');
  const zipdir = require('zip-dir');
  const { parse } = require('yaml');
  const { marked } = require('marked');
  const hljs = require('highlight.js');

  fs.writeFileSync('dist/index.js', fs.readFileSync('dist/index.js').toString().replace('__VERSION__', fs.readJSONSync('package.json').version));
  const fileList = [
    'config.example.yml',
    'CHANGELOG.txt',
    'dailyQuestDb.json',
    'package.json',
    'scripts/modules_checker.js',
    'scripts/node_checker.ps1',
    'scripts/node_checker.sh',
    'scripts/node_checker.bat'
  ];
  fileList.forEach((e) => {
    fs.copySync(e, `dist/${e}`);
  });

  const readmeFileList = [
    'README',
    'README_EN'
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
  fs.copySync('configer/configer.template.yml.js', 'dist/configer.template.yml.js');

  fs.writeFileSync('dist/运行.bat', 'cd "%~dp0" && start cmd /k "node index.js"');
  fs.writeFileSync('dist/Run.bat', 'cd "%~dp0" && start cmd /k "node index.js"');
  // eslint-disable-next-line max-len
  fs.writeFileSync('dist/运行-auto.bat', 'cd "%~dp0" && where "powershell" && powershell -file "scripts/node_checker.ps1" || where "pwsh" && pwsh -file "scripts/node_checker.ps1" || .\\scripts\\node_checker.bat && pause');
  // eslint-disable-next-line max-len
  fs.writeFileSync('dist/Run-auto.bat', 'cd "%~dp0" && where "powershell" && powershell -file "scripts/node_checker.ps1" || where "pwsh" && pwsh -file "scripts/node_checker.ps1" || .\\scripts\\node_checker.bat && pause');
  fs.writeFileSync('dist/run_auto_linux.sh', './scripts/node_checker.sh');
  await zipdir('dist', { saveTo: './AWA-Helper.zip' });
})();
