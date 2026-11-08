#!/usr/bin/env node
/**
 * Captures the real extension UI for the landing page (site/assets/shots/*.png).
 *
 * It loads the built extension (dist/) into a headless Chromium, opens the real
 * side panel page, and stubs only the browser-tab plumbing (which tab is active,
 * what the Discord content script reports, and a fake upload port) so the UI can
 * be shown in meaningful states. Everything rendered is the shipped React UI.
 *
 *   pnpm build
 *   CHROME_BIN="/path/to/chromium" node tools/site/capture-screens.mjs
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const DIST = path.join(ROOT, 'dist');
const OUT = path.join(ROOT, 'site', 'assets', 'shots');
const CHROME =
  process.env.CHROME_BIN ||
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
if (!fs.existsSync(CHROME)) throw new Error(`Browser not found: ${CHROME} (set CHROME_BIN)`);
if (!fs.existsSync(path.join(DIST, 'manifest.json'))) throw new Error('Run `pnpm build` first.');
fs.mkdirSync(OUT, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const PORT = 9400 + Math.floor(Math.random() * 400);

// ---------- sample files (random bytes; only names and sizes matter) ----------
const FILES_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'decima-shots-'));
const KB = 1024, MB = 1024 * KB;
const sample = [
  ['DSC_0412.jpg', 1.4 * MB], ['DSC_0413.jpg', 1.1 * MB], ['DSC_0414.jpg', 1.8 * MB], ['DSC_0415.jpg', 1.3 * MB],
  ['DSC_0416.jpg', 960 * KB], ['DSC_0417.jpg', 1.6 * MB], ['DSC_0418.jpg', 1.2 * MB], ['DSC_0419.jpg', 1.9 * MB],
  ['DSC_0420.jpg', 1.0 * MB], ['DSC_0421.jpg', 1.5 * MB], ['cover-final.png', 2.3 * MB], ['tracklist.pdf', 310 * KB],
  ['mixdown-v3.wav', 4.8 * MB], ['mixdown-v3-alt.wav', 4.6 * MB], ['stems.zip', 6.2 * MB], ['credits.txt', 4 * KB],
  ['poster-a3.png', 3.1 * MB], ['poster-a3-dark.png', 3.3 * MB], ['teaser-clip.mp4', 8.7 * MB], ['behind-1.jpg', 1.7 * MB],
  ['behind-2.jpg', 1.4 * MB], ['behind-3.jpg', 1.6 * MB], ['rough-cut.mp4', 14.2 * MB],
].map(([n, s]) => {
  const p = path.join(FILES_DIR, n);
  fs.writeFileSync(p, Buffer.alloc(Math.round(s), 7));
  return p;
});

// ---------- tab plumbing stub, injected before the page scripts ----------
const stub = (scenario) => `(() => {
  const SC = ${JSON.stringify(scenario)};
  const tab = SC === 'ig'
    ? { id: 7, url: 'https://www.instagram.com/stories/slowroutes/', title: 'Stories \u2022 Instagram' }
    : { id: 7, url: 'https://discord.com/channels/1180000000000000001/1180000000000000002', title: '#release-assets | Night Shift Collective | Discord' };
  const ctx = { guildId: '1180000000000000001', channelId: '1180000000000000002', guildName: 'Night Shift Collective',
    channelName: 'release-assets', isDM: false, canSend: true };
  const put = (o, k, v) => { try { o[k] = v; } catch (e) {} if (o[k] !== v) { try { Object.defineProperty(o, k, { value: v, configurable: true }); } catch (e) {} } };
  put(chrome.tabs, 'query', async () => [tab]);
  put(chrome.tabs, 'sendMessage', async (_id, m) => (m && m.type === 'GET_CONTEXT' ? ctx : undefined));
  put(chrome.tabs, 'connect', () => {
    const ls = []; let bid = '';
    return {
      name: 'dbu-upload', onMessage: { addListener: (f) => ls.push(f) }, onDisconnect: { addListener() {} }, disconnect() {},
      postMessage(m) {
        if (m.t === 'begin') bid = m.batchId;
        if (m.t === 'commit') setTimeout(() => { ls.forEach((l) => l({ t: 'stage', batchId: bid, stage: 'submitted' })); ls.forEach((l) => l({ t: 'done', batchId: bid })); }, 700);
      },
    };
  });
})();`;

// ---------- minimal CDP client ----------
async function cdp(wsUrl) {
  const ws = new WebSocket(wsUrl);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  let id = 0; const wait = new Map();
  ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && wait.has(m.id)) { wait.get(m.id)(m); wait.delete(m.id); } };
  const send = (method, params = {}) => new Promise((res, rej) => {
    const i = ++id; wait.set(i, (m) => (m.error ? rej(new Error(method + ': ' + m.error.message)) : res(m.result)));
    ws.send(JSON.stringify({ id: i, method, params }));
  });
  const ev = async (expression) => (await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })).result.value;
  return { send, ev, close: () => ws.close() };
}

const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'decima-chrome-'));
const chrome = spawn(CHROME, [
  '--headless=new', '--no-sandbox', '--hide-scrollbars', `--user-data-dir=${profile}`, `--remote-debugging-port=${PORT}`,
  `--disable-extensions-except=${DIST}`, `--load-extension=${DIST}`, 'about:blank',
], { stdio: 'ignore' });
const cleanup = () => { try { chrome.kill('SIGKILL'); } catch {} try { fs.rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }); } catch {} try { fs.rmSync(FILES_DIR, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }); } catch {} };
process.on('exit', cleanup);

async function json(p, init) { return (await fetch(`http://127.0.0.1:${PORT}${p}`, init)).json(); }
let extId = '';
for (let i = 0; i < 60 && !extId; i++) {
  await sleep(300);
  try { const l = await json('/json'); const sw = l.find((t) => t.type === 'service_worker' && t.url.startsWith('chrome-extension://')); if (sw) extId = new URL(sw.url).host; } catch {}
}
if (!extId) throw new Error('Extension did not start');
console.log('extension id', extId);

async function page(url, scenario, { width, height }) {
  const t = await json('/json/new?about:blank', { method: 'PUT' });
  const c = await cdp(t.webSocketDebuggerUrl);
  await c.send('Page.enable'); await c.send('Runtime.enable');
  await c.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 2, mobile: false });
  if (scenario) await c.send('Page.addScriptToEvaluateOnNewDocument', { source: stub(scenario) });
  await c.send('Page.navigate', { url });
  await sleep(1400);
  // a stale metrics override renders the page at 1x inside a 2x frame (content fills a quarter of the shot)
  for (let i = 0; i < 5; i++) {
    const dpr = await c.ev('window.devicePixelRatio');
    if (dpr === 2) break;
    await c.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 2, mobile: false });
    await sleep(400);
  }
  return c;
}
const shot = async (c, name, clip) => {
  const { data } = await c.send('Page.captureScreenshot', { format: 'png', ...(clip ? { clip: { ...clip, scale: 1 } } : {}) });
  fs.writeFileSync(path.join(OUT, name), Buffer.from(data, 'base64')); // PNG; convert with: python3 tools/site/optimize-shots.py
  console.log('wrote', name);
};
const clickText = (c, text) => c.ev(`(() => { const b=[...document.querySelectorAll('button')].find(x=>x.textContent.trim().startsWith(${JSON.stringify(text)})); if(!b) return false; b.click(); return true; })()`);
const addFiles = async (c) => {
  const { result } = await c.send('Runtime.evaluate', { expression: `document.querySelector('input[type=file]')` });
  await c.send('DOM.enable');
  await c.send('DOM.setFileInputFiles', { objectId: result.objectId, files: sample });
  await sleep(500);
};

try {
  const panelUrl = `chrome-extension://${extId}/sidepanel.html`;
  const SIZE = { width: 400, height: 780 };

  // 1) target detected, nothing queued
  let c = await page(panelUrl, 'discord', SIZE);
  await shot(c, 'panel-target.png');
  // 2) files queued and grouped into messages
  await addFiles(c);
  await shot(c, 'panel-queue.png');
  // 3) mid-run: first message sent, waiting before the next
  await clickText(c, 'Send');
  await sleep(2200);
  await shot(c, 'panel-run.png');
  c.close();

  // 4) Ephemera tab on an Instagram page
  c = await page(panelUrl, 'ig', SIZE);
  await clickText(c, 'Ephemera');
  await sleep(500);
  await shot(c, 'panel-ephemera.png');
  c.close();

  // 5) popup
  c = await page(`chrome-extension://${extId}/popup.html`, 'discord', { width: 340, height: 420 });
  await sleep(600);
  const h = await c.ev('document.documentElement.scrollHeight');
  await c.send('Emulation.setDeviceMetricsOverride', { width: 340, height: h, deviceScaleFactor: 2, mobile: false });
  await sleep(300);
  await shot(c, 'popup.png');
  c.close();

  // 6) profile bulk-download dialog (real template + stylesheet from the source)
  const src = fs.readFileSync(path.join(ROOT, 'lib/ephemera/instagram/profile-ui.ts'), 'utf8');
  const tpl = src.match(/`(\s*<style>[\s\S]*?<\/div>\s*)`/)?.[1];
  if (!tpl) throw new Error('profile dialog template not found');
  // the template interpolates the Ephemera logo; feed it the real asset instead of dropping it
  const logoUrl = 'data:image/svg+xml;base64,' + fs.readFileSync(path.join(ROOT, 'assets', 'ephemera', 'logo.svg')).toString('base64');
  const html = `<!doctype html><meta charset=utf-8><body style="margin:0;background:#1b1c1f;display:flex;justify-content:center;padding:28px">${tpl
    .replace('${totalPosts}', '128').replace('${LOGO_URL}', logoUrl).replace(/\$\{[^}]*\}/g, '')}`;
  const tmp = path.join(FILES_DIR, 'dialog.html'); fs.writeFileSync(tmp, html);
  c = await page(`file://${tmp}`, null, { width: 560, height: 1500 });
  const dim = await c.ev(`(() => { const m=document.querySelector('.eph-modal'); const r=m.getBoundingClientRect(); return {x:r.x,y:r.y,w:r.width,h:r.height}; })()`);
  await shot(c, 'dialog-profile.png', { x: dim.x - 28, y: dim.y - 28, width: dim.w + 56, height: dim.h + 56 });
  c.close();

  // 7) where the buttons appear on Instagram and Facebook: mock pages + the real built stylesheet
  const css = fs.readFileSync(path.join(DIST, 'content-scripts', 'instagram.css'), 'utf8');
  const photos = 'file://' + path.join(ROOT, 'tools', 'site', 'photos');
  const mock = fs.readFileSync(path.join(ROOT, 'tools', 'site', 'mock-pages.html'), 'utf8')
    .replaceAll('__PHOTOS__', photos).replace('</head>', `<style>${css}</style></head>`);
  const mockFile = path.join(FILES_DIR, 'mock.html'); fs.writeFileSync(mockFile, mock);
  c = await page(`file://${mockFile}`, null, { width: 640, height: 820 }); // one metrics override only: a second one leaves a stale frame
  const bgReady = await c.ev(`(async () => {
    const urls = [...document.querySelectorAll('.ph, .av i, .grid i')].map((e) => getComputedStyle(e).backgroundImage).filter((b) => b.startsWith('url('))
      .map((b) => b.slice(5, -2));
    const res = await Promise.all([...new Set(urls)].map((u) => new Promise((r) => { const i = new Image(); i.onload = () => r(u + ' ' + i.naturalWidth + 'x' + i.naturalHeight); i.onerror = () => r('FAILED ' + u); i.src = u; })));
    return res;
  })()`);
  console.log('mock photos:', bgReady.join(' | '));
  if (bgReady.some((r) => r.startsWith('FAILED'))) throw new Error('mock photo failed to load');
  await sleep(500);
  for (const [id, name] of [['ig-story', 'ig-story.png'], ['ig-post', 'ig-post.png'], ['fb-story', 'fb-story.png'], ['fb-feed', 'fb-feed.png'], ['ig-prof', 'ig-profile.png']]) {
    // show exactly one stage at the page origin, so the capture cannot include a neighbour
    const r = await c.ev(`(() => {
      document.querySelectorAll('.stage').forEach((e) => { e.style.display = e.id === ${JSON.stringify(id)} ? '' : 'none'; });
      const e = document.getElementById(${JSON.stringify(id)}); const b = e.getBoundingClientRect();
      return { w: b.width, h: b.height, x: b.x, y: b.y };
    })()`);
    await sleep(300);
    await shot(c, name, { x: r.x, y: r.y, width: r.w, height: r.h });
  }
  c.close();
} finally {
  cleanup();
}
process.exit(0);
