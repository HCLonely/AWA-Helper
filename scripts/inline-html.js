const fs = require('fs');
const path = require('path');
const { inlineSource } = require('inline-source');
const { minify } = require('html-minifier-terser');

const tasks = [
  { src: 'src/webUI/index.html', dest: 'src/webUI/dist/' },
  { src: 'src/manager/index.html', dest: 'src/manager/dist/' },
  { src: 'src/manager/configer/index.html', dest: 'src/manager/dist/', rename: 'configer.html' },
];

async function processHtml({ src, dest, rename }) {
  const rootpath = path.resolve(path.dirname(src));
  const html = fs.readFileSync(src, 'utf8');
  const inlined = await inlineSource(html, { compress: false, rootpath });
  const result = await minify(inlined, {
    removeComments: true,
    collapseWhitespace: true,
    collapseBooleanAttributes: true,
    removeEmptyAttributes: true,
    minifyJS: true,
    minifyCSS: true,
  });
  const outDir = path.resolve(dest);
  fs.mkdirSync(outDir, { recursive: true });
  const outName = rename || path.basename(src);
  fs.writeFileSync(path.join(outDir, outName), result);
}

(async () => {
  await Promise.all(tasks.map(processHtml));
  console.log('HTML inline + minify complete.');
})();
