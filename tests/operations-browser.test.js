/**
 * @file tests/operations-browser.test.js
 * @description 验证运维页面的浏览器交互行为。
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const test = require('node:test');
const {
  findBrowser, runBrowser
} = require('./helpers/browser');

test('operations dashboard renders hostile text safely, previews cron, diagnoses and recovers from API errors', async t => {
  const root = path.resolve(__dirname, '../src/webUI');
  const html = fs.readFileSync(path.join(root, 'operations.html'), 'utf8').match(/<main id="operations"[\s\S]*?<\/main>/)[0];
  const code = fs.readFileSync(path.join(root, 'static/js/pages/operations.js'), 'utf8');
  const server = http.createServer((_req, res) => {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end(`<!doctype html><html><body>${html}<script>
      window.lang='zh';sessionStorage.setItem('managerServerSecret','synthetic-browser-secret');
      window.calls=[];window.fail=false;window.exports=[];
      window.axios={get:async(url,options)=>{calls.push({url,options});if(fail)throw {response:{status:401}};
        if(url==='/api/history')return {data:{runs:[{name:'<img src=x onerror="window.bad=true">',source:'schedule',status:'interrupted',startedAt:'2026-09-15T00:00:00Z',steps:[]}],failures:{dailyQuest:1}}};
        if(url==='/api/schedules')return {data:{schedules:[{name:'dailyQuest',cron:'0 14 * * *',timezone:'UTC',active:true,nextRuns:['2026-09-15T14:00:00Z']}]}};
        return {data:new Blob(['{}'])};},post:async(url,body,options)=>{calls.push({url,body,options});
          return {data:url.includes('preview')?{nextRuns:['2026-09-15T14:00:00Z']}:{checks:[{platform:'awa',code:'session-expired',checkedAt:'2026-09-15T00:00:00Z'}]}};}};
      HTMLAnchorElement.prototype.click=function(){exports.push(this.download)};
    </script><script>${code}</script><script>
      (async()=>{
        const click=async(action)=>{document.querySelector('[data-operation="'+action+'"]').click();await new Promise(resolve=>setTimeout(resolve,30));};
        await new Promise(resolve=>setTimeout(resolve,30));
        await click('refresh'); const safe=!window.bad&&!document.querySelector('#run-history img')&&document.querySelector('#run-history').textContent.includes('<img');
        await click('preview'); const preview=document.querySelector('#schedule-preview').textContent;
        await click('diagnose'); const diagnosis=document.querySelector('#diagnostic-results').textContent;
        await click('export');fail=true;await click('refresh');const failure=document.querySelector('#operations-status').textContent;
        fail=false;await click('refresh');
        const result={total:document.querySelector('#metric-total').textContent,attention:document.querySelector('#metric-attention').textContent,scheduleCards:document.querySelectorAll('#schedule-list .record-card').length,safe,preview,diagnosis,failure,recovered:document.querySelector('#operations-status').textContent==='已完成',
          authenticated:calls.every(call=>call.options.headers.Authorization==='Bearer synthetic-browser-secret'),exports,
          enabled:Array.from(document.querySelectorAll('[data-operation]')).every(button=>!button.disabled)};
        const pre=document.createElement('pre');pre.id='test-result';pre.textContent=JSON.stringify(result);document.body.append(pre);
      })().catch(error=>{const pre=document.createElement('pre');pre.id='test-result';pre.textContent=JSON.stringify({error:String(error)});document.body.append(pre)});
    </script></body></html>`);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => { server.closeAllConnections(); server.close(); });
  const result = await runBrowser(`http://127.0.0.1:${server.address().port}`, {
    executable: findBrowser()
  });
  assert.equal(result.total, '1'); assert.equal(result.attention, '1'); assert.equal(result.scheduleCards, 1);
  assert.equal(result.error, undefined); assert.equal(result.safe, true); assert.equal(result.authenticated, true);
  assert.match(result.preview, /UTC|Asia|America|Europe/); assert.match(result.diagnosis, /Cookie/);
  assert.ok(result.failure); assert.equal(result.recovered, true); assert.equal(result.enabled, true);
  assert.deepEqual(result.exports, ['awa-diagnostics.json']);
});
