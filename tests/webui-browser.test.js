/**
 * @file tests/webui-browser.test.js
 * @description 验证 WebUI 页面在浏览器中的交互行为。
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const {
  findBrowser, runBrowser
} = require('./helpers/browser');
const test = require('node:test');
const yaml = require('yaml');

const root = path.resolve(__dirname, '..');
const browser = findBrowser();
const base = {
  language: 'zh',
  awaCookie: 'REMEMBERME=synthetic-cookie',
  awaQuests: ['dailyQuest'],
  awaHost: 'www.alienwarearena.com',
  timeout: 0,
  webUI: {
    enable: true,
    port: 2345,
    local: true
  },
  customExtension: {
    preserved: true
  },
  manager: {
    secret: 'synthetic-manager-secret',
    dailyQuest: {
      cron: '0 14 * * *'
    },
    achievement: {
      enable: false,
      cron: '0 14 * * *'
    },
    artifacts: [{
      cron: '0 15 * * *',
      ids: [1, 2, 3]
    }]
  }
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
  let html = source('settings.html').replace('__LANG__', 'en').replace('__I18N__', JSON.stringify({
    en: yaml.parse(fs.readFileSync(path.resolve(__dirname, '../src/locales/en.yml'), 'utf8'))
  }));
  html = html.replace(/<link inline href="([^"]+)" rel="stylesheet">/g, (_, file) => `<style>${source(file)}</style>`);
  html = html.replace(/<script inline src="([^"]+)"><\/script>/g, (_, file) => script(file.includes('axios.min') ? mock : source(file)));
  return html.replace('</body>', script(`
    setTimeout(async()=>{try {
      const mode=${JSON.stringify(mode)};
      if(mode==='collapsed') document.querySelectorAll('.collapse').forEach(element=>element.classList.remove('show'));
      if(mode==='delete-last') document.querySelector('[data-field-path="manager.artifacts"] .delete-repeat').click();
      document.querySelector('form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));
      await new Promise(resolve=>setTimeout(resolve,100));
      const pre=document.createElement('pre');pre.id='test-result';pre.textContent=JSON.stringify(saved[0]||{error:'No config saved'});document.body.append(pre);
    } catch(error) {
      const pre=document.createElement('pre');pre.id='test-result';pre.textContent=JSON.stringify({error:String(error)});document.body.append(pre);
    }},100);
  `) + '</body>');
};

test('browser preserves collapsed settings, supports empty artifacts and bounds live logs', {
  skip: !browser,
  timeout: 60000
}, async (t) => {
  const server = http.createServer((req, res) => { res.setHeader('Content-Type', 'text/html; charset=utf-8'); try { res.end(page(req.url.slice(1))); } catch (error) { res.end('<pre id="test-result">' + JSON.stringify({
    error: error.message
  }) + '</pre>'); } });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve) => { server.closeAllConnections(); server.close(resolve); }));
  for (const mode of ['collapsed', 'empty', 'delete-last', 'logs', 'preview']) {
    const result = await runBrowser(`http://127.0.0.1:${server.address().port}/${mode}`, {
      executable: browser
    });
    assert.equal(result.error, undefined, `${mode}: ${result.error}`);
    if (mode === 'preview') {
      assert.deepEqual(result, {
        safe: true,
        text: 'older page',
        dialogs: 1,
        closed: 0,
        authenticated: true,
        buttons: ['logOlder','logLatest','logClose'],
        downloads: [],
        pagesOnly: true
      });
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
