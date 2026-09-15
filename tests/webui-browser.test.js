const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const test = require('node:test');
const yaml = require('yaml');

const root = path.resolve(__dirname, '..');
const browser = [process.env.BROWSER_EXECUTABLE,
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  '/usr/bin/chromium', '/usr/bin/google-chrome'
].find((candidate) => candidate && fs.existsSync(candidate));
const base = {
  language: 'zh', awaCookie: 'REMEMBERME=synthetic-cookie', awaQuests: ['dailyQuest'],
  awaHost: 'www.alienwarearena.com', timeout: 0, webUI: { enable: true, port: 2345, local: true },
  customExtension: { preserved: true },
  manager: { secret: 'synthetic-manager-secret', dailyQuest: { cron: '0 14 * * *' },
    achievement: { enable: false, cron: '0 14 * * *' }, artifacts: [{ cron: '0 15 * * *', ids: [1, 2, 3] }] }
};
const source = (file) => fs.readFileSync(path.join(root, 'src/webUI', file), 'utf8');
const script = (code) => `<script>${code.replace(/<\/script/gi, '<\\/script')}</script>`;

const page = (mode) => {
  if (mode === 'preview') {
    return '<!doctype html><body>' + script(`
      window.onerror=(message)=>{const pre=document.createElement('pre');pre.id='test-result';pre.textContent=JSON.stringify({error:String(message)});document.body.append(pre)};
      window.__=(key)=>key; window.reads=0; window.headers=[]; window.downloads=[]; window.requests=[];
      HTMLAnchorElement.prototype.click=function(){downloads.push(this.getAttribute('href'))};
      window.fetch=async(url, options)=>{headers.push(options.headers.Authorization);requests.push(url);
        return {ok:true,json:async()=>({text:++reads===1?'<script>window.bad=true</scr'+'ipt>'+ 'x'.repeat(64000):'older page',older:reads===1?'cursor':undefined})}};
    `) + script(source('static/js/pages/log-preview.js')) + script(`
      openLogPreview('manager','synthetic-secret');
      setTimeout(()=>{
        const safe=!window.bad && document.querySelector('dialog pre').textContent.startsWith('<script>');
        document.querySelector('dialog button').click();
        setTimeout(async()=>{
          const text=document.querySelector('dialog pre').textContent;
          const buttons=Array.from(document.querySelectorAll('dialog button'),item=>item.textContent);
          openLogPreview('manager','synthetic-secret');
          const dialogs=document.querySelectorAll('dialog').length;
          document.querySelector('dialog button:last-child').click();
          const result={safe,text,dialogs,closed:document.querySelectorAll('dialog').length,authenticated:headers.every(value=>value==='Bearer synthetic-secret'),buttons,downloads,pagesOnly:requests.every(url=>url.includes('/page'))};
          const pre=document.createElement('pre');pre.id='test-result';pre.textContent=JSON.stringify(result);document.body.append(pre);
        },100);
      },100);
    `) + '</body>';
  }
  if (mode === 'logs') {
    return '<!doctype html><body><ul id="log-area"></ul>' + script(`
      window.I18n={}; window.lang='zh'; window.dayjs=()=>({format:()=> 'now'});
      window.WebSocket=class {constructor(){window.testSocket=this}};
    `) + script(source('static/js/pages/native-dom.js')) + script(source('static/js/pages/dailyQuest.js')) + script(`
      testSocket.onopen();
      for (let id=1;id<=1500;id++) testSocket.onmessage({data:JSON.stringify({type:'log',scope:'dailyQuest',id,data:'log'})});
      requestAnimationFrame(() => {
      const rows=document.querySelectorAll('#log-area li').length;
      const last=document.querySelector('#log-area li:last-child').id;
      const pre=document.createElement('pre');pre.id='test-result';pre.textContent=JSON.stringify({rows,last});document.body.append(pre);
      });
    `) + '</body>';
  }
  const config = structuredClone(base);
  if (mode === 'empty') config.manager.artifacts = [];
  const mock = `sessionStorage.managerServerSecret='synthetic-manager-secret';window.saved=[];
    window.axios={get:async(url)=>({status:200,data:url.includes('template.yml')?${JSON.stringify(source('static/templates/config.zh.yml'))}:${JSON.stringify(yaml.stringify(config))}}),
      put:async(_url,body)=>{saved.push(jsyaml.load(body.config));return {status:200,data:{}}}};`;
  let html = source('settings.html');
  html = html.replace(/<link inline href="([^"]+)" rel="stylesheet">/g, (_, file) => `<style>${source(file)}</style>`);
  html = html.replace(/<script inline src="([^"]+)"><\/script>/g, (_, file) => script(file.includes('axios.min') ? mock : source(file)));
  return html.replace('</body>', script(`
    setTimeout(async()=>{try {
      const mode=${JSON.stringify(mode)};
      if(mode==='collapsed') document.querySelectorAll('.collapse').forEach(element=>element.classList.remove('show'));
      if(mode==='delete-last') document.querySelector('#config-AWA-Helper-manager-artifacts .delete-repeat').click();
      document.querySelector('form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));
      await new Promise(resolve=>setTimeout(resolve,100));
      const pre=document.createElement('pre');pre.id='test-result';pre.textContent=JSON.stringify(saved[0]||{error:'No config saved'});document.body.append(pre);
    } catch(error) {
      const pre=document.createElement('pre');pre.id='test-result';pre.textContent=JSON.stringify({error:String(error)});document.body.append(pre);
    }},100);
  `) + '</body>');
};

test('browser preserves collapsed settings, supports empty artifacts and bounds live logs', { skip: !browser, timeout: 60000 }, async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'awa-browser-regression-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 }));
  const server = http.createServer((req, res) => { res.setHeader('Content-Type', 'text/html; charset=utf-8'); try { res.end(page(req.url.slice(1))); } catch (error) { res.end('<pre id="test-result">' + JSON.stringify({ error: error.message }) + '</pre>'); } });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve) => { server.closeAllConnections(); server.close(resolve); }));
  for (const mode of ['collapsed', 'empty', 'delete-last', 'logs', 'preview']) {
    const child = spawn(browser, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
      '--disable-background-networking', `--user-data-dir=${path.join(directory, mode)}`, '--virtual-time-budget=3000',
      '--dump-dom', `http://127.0.0.1:${server.address().port}/${mode}`], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';
    let errors = '';
    child.stdout.on('data', (data) => { output += data; });
    child.stderr.on('data', (data) => { errors += data; });
    const deadline = setTimeout(() => child.kill(), 12000);
    try {
      await new Promise((resolve, reject) => { child.once('error', reject); child.once('close', resolve); });
    } finally { clearTimeout(deadline); }
    const match = output.match(/<pre id="test-result">(.+?)<\/pre>/s);
    assert.ok(match, `${mode}: browser returned no result: ${errors.slice(-500)}`);
    const result = JSON.parse(match[1].replaceAll('&quot;', '"').replaceAll('&amp;', '&'));
    assert.equal(result.error, undefined, `${mode}: ${result.error}`);
    if (mode === 'preview') {
      assert.deepEqual(result, { safe: true, text: 'older page', dialogs: 1, closed: 0, authenticated: true,
        buttons: ['logOlder','logLatest','logClose'], downloads: [], pagesOnly: true });
    } else if (mode === 'logs') {
      assert.ok(result.rows <= 1000);
      assert.match(result.last, /1500$/);
    } else {
      assert.equal(result.manager.secret, base.manager.secret);
      assert.deepEqual(result.customExtension, base.customExtension);
      assert.deepEqual(result.manager.artifacts, mode === 'collapsed' ? base.manager.artifacts : []);
      assert.deepEqual(result.manager.dailyQuest, base.manager.dailyQuest);
    }
  }
});
