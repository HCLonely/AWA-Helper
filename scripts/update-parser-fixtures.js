/**
 * @file scripts/update-parser-fixtures.js
 * @description 从本地 HAR 中按允许列表提取匿名化控制中心样本，不保存请求头或 Cookie。
 */
const fs = require('node:fs');
const path = require('node:path');
const {
  load
} = require('cheerio');

const input = process.argv[2];
const version = process.argv[3];
if (!input || !/^v\d+$/.test(version || '')) {
  throw new Error('Usage: node scripts/update-parser-fixtures.js <local.har> <vN>');
}
const target = path.join(__dirname, '..', 'tests', 'fixtures', 'control-center', version);
if (fs.existsSync(target)) { throw new Error('Fixture version already exists; use a new version'); }
const raw = fs.readFileSync(input, 'utf8');
let html;
const appendedHtml = raw.indexOf('\n<!DOCTYPE html>');
if (appendedHtml >= 0) {
  // 仓库中的旧版 .xhr 样本由 HAR 元数据和后续原始 HTML 组成。
  html = raw.slice(appendedHtml);
} else {
  const har = JSON.parse(raw);
  const entry = har.log?.entries?.find(item => {
    try { return new URL(item.request.url).pathname === '/control-center' && item.response.status === 200; }
    catch { return false; }
  });
  if (!entry) { throw new Error('No successful control-center response in HAR'); }
  const {
    content
  } = entry.response;
  html = content.encoding === 'base64' ? Buffer.from(content.text, 'base64').toString('utf8') : content.text;
}
const $ = load(html);
const source = JSON.parse(html.match(/dailyArpData\s*=\s*({.+?}})/)?.[1] || 'null');
if (!source || !$('div.user-profile__card-body').length) { throw new Error('Sample does not match the known structure'); }
const data = Object.fromEntries(['timeOnSiteCap', 'timeOnSiteArp', 'dailyArp'].map(key => [key, Number(source[key])]));
data.twitchData = {
  totalPoints: Number(source.twitchData.totalPoints),
  bonusPoints: Number(source.twitchData.bonusPoints)
};
const bodies = $('div.user-profile__card-body').slice(0, 2).clone();
bodies.find('script, style, img, iframe, input, textarea, form').remove();
bodies.find('*').addBack().each((_i, node) => {
  for (const key of Object.keys(node.attribs || {})) {
    if (!['class', 'id', 'href', 'data-quest-id', 'data-award-on-click'].includes(key)) { $(node).removeAttr(key); }
  }
  const href = $(node).attr('href');
  if (href) { $(node).attr('href', href.startsWith('/quests/') ? '/quests/fixture' : '/ajax/fixture'); }
  if ($(node).attr('data-quest-id')) { $(node).attr('data-quest-id', '42'); }
  if ($(node).hasClass('quest-title')) { $(node).text('Fixture quest'); }
  // 仅保留进度、状态和数值文本，忽略其他账户或内容文本。
  (node.children || []).filter(child => child.type === 'text').forEach(child => {
    if (!/^\s*(?:(?:in)?complete|started|not started|\d[\d\s+]*\s*(?:ARP)?|Fixture quest)?\s*$/i.test(child.data)) { child.data = ''; }
  });
});
const script = `<script>let dailyArpData = ${JSON.stringify(data)};</script>`;
const bodyHtml = bodies.toArray().map(node => $.html(node)).join('\n').replace(/[ \t]+$/gm, '');
fs.mkdirSync(target, {
  recursive: true
});
fs.writeFileSync(path.join(target, 'normal.html'), `<!doctype html><html><body>${script}\n${bodyHtml}</body></html>\n`);
fs.writeFileSync(path.join(target, 'empty.html'), `<!doctype html><html><body>${script}<div class="user-profile__card-body"></div><div class="user-profile__card-body"></div></body></html>\n`);
fs.writeFileSync(path.join(target, 'expired.html'), '<html><body><a class="nav-link-login" href="/login">Log in</a></body></html>\n');
fs.writeFileSync(path.join(target, 'changed.html'), '<html><body><main class="new-dashboard">Unexpected layout</main></body></html>\n');
fs.writeFileSync(path.join(target, 'network-error.html'), '<html><body>We have detected an issue with your network</body></html>\n');
console.log(`Created ${version}: anonymized normal page and four derived failure/empty scenarios`);
