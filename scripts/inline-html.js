/**
 * @file scripts/inline-html.js
 * @description 内联 WebUI 页面依赖的脚本、样式和图标资源。
 */
const fs = require('fs');
const path = require('path');
const {
  inlineSource
} = require('inline-source');
const {
  minify
} = require('html-minifier-terser');

const tasks = [
  {
    src: 'src/webUI/login.html',
    dest: 'src/webUI/dist/'
  },
  {
    src: 'src/webUI/operations.html',
    dest: 'src/webUI/dist/'
  },
  {
    src: 'src/webUI/index.html',
    dest: 'src/webUI/dist/'
  },
  {
    src: 'src/webUI/dailyQuest.html',
    dest: 'src/webUI/dist/'
  },
  {
    src: 'src/webUI/achievement.html',
    dest: 'src/webUI/dist/'
  },
  {
    src: 'src/webUI/settings.html',
    dest: 'src/webUI/dist/'
  },
];

async function processHtml({
  src, dest, rename
}) {
  const rootpath = path.resolve(path.dirname(src));
  const html = fs.readFileSync(src, 'utf8').replace('__CHANGELOG__', () => fs.readFileSync('CHANGELOG.txt', 'utf8')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'));
  const inlined = await inlineSource(html, {
    compress: false,
    rootpath,
    svgAsImage: false,
    preHandlers: [(source) => {
      // inline-source 未识别 ICO MIME 类型，在读取前声明为二进制图片。
      if (source.tag === 'link' && source.attributes.rel === 'icon' && source.extension === 'ico') {
        source.type = 'image';
        source.format = 'x-icon';
      }
    }]
  });
  const result = await minify(inlined, {
    removeComments: true,
    collapseWhitespace: true,
    collapseBooleanAttributes: true,
    removeEmptyAttributes: true,
    minifyJS: true,
    minifyCSS: true,
  });
  const outDir = path.resolve(dest);
  fs.mkdirSync(outDir, {
    recursive: true
  });
  const outName = rename || path.basename(src);
  fs.writeFileSync(path.join(outDir, outName), result);
}

(async () => {
  await Promise.all(tasks.map(processHtml));
  console.log('HTML inline + minify complete.');
})();
