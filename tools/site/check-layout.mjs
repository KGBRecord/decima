#!/usr/bin/env node
/**
 * Layout check for the landing page at real viewport widths (CDP device metrics).
 * Reports horizontal overflow, elements wider than the viewport and wrapped CTAs, and
 * writes full-page screenshots to site/.shots/ (git-ignored).
 *
 *   CHROME_BIN="/path/to/chromium" node tools/site/check-layout.mjs
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT = path.join(ROOT, 'site', '.shots');
const CHROME = process.env.CHROME_BIN || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const PORT = 9800 + Math.floor(Math.random() * 150);
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'dissend-site-'));
const chrome = spawn(CHROME, ['--headless=new', '--no-sandbox', '--hide-scrollbars', `--user-data-dir=${profile}`, `--remote-debugging-port=${PORT}`, 'about:blank'], { stdio: 'ignore' });
const done = () => { try { chrome.kill('SIGKILL'); } catch {} try { fs.rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }); } catch {} };
process.on('exit', done);

for (let i = 0; i < 50; i++) { try { await fetch(`http://127.0.0.1:${PORT}/json/version`); break; } catch { await sleep(200); } }
const t = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json();
const ws = new WebSocket(t.webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0; const waits = new Map();
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && waits.has(m.id)) { waits.get(m.id)(m.result); waits.delete(m.id); } };
const send = (method, params = {}) => new Promise((r) => { const i = ++id; waits.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (expression) => (await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })).result.value;

await send('Page.enable'); await send('Runtime.enable');
let failed = false;
for (const [name, width, height] of [['desktop', 1440, 900], ['laptop', 1024, 768], ['tablet', 768, 1024], ['mobile', 390, 844]]) {
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 700 });
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  await send('Page.navigate', { url: 'file://' + path.join(ROOT, 'site', 'index.html') });
  await sleep(900);
  await ev(`(async () => { document.querySelectorAll('img[loading=lazy]').forEach((i) => { i.loading = 'eager'; }); await Promise.all([...document.images].map((i) => i.complete ? 1 : new Promise((r) => { i.onload = i.onerror = r; }))); })()`);
  await sleep(300);
  const r = await ev(`(() => {
    const vw = document.documentElement.clientWidth;
    const over = [...document.querySelectorAll('body *')].filter((e) => { const b = e.getBoundingClientRect(); return b.width > 0 && (b.right > vw + 1 || b.left < -1) && getComputedStyle(e).position !== 'fixed'; })
      .slice(0, 6).map((e) => e.tagName.toLowerCase() + '.' + e.className + ' ' + Math.round(e.getBoundingClientRect().right));
    const broken = [...document.images].filter((i) => !i.complete || i.naturalWidth === 0).map((i) => i.getAttribute('src'));
    const btns = [...document.querySelectorAll('.btn')].filter((b) => b.getBoundingClientRect().height > 64).map((b) => b.textContent.trim());
    const h1 = document.querySelector('h1'); const lh = parseFloat(getComputedStyle(h1).lineHeight);
    const hero = document.querySelector('.hero-copy .cta').getBoundingClientRect().bottom;
    return { vw, scrollW: document.documentElement.scrollWidth, over, wrappedBtns: btns, broken, h1Lines: Math.round(h1.getBoundingClientRect().height / lh), ctaBottom: Math.round(hero), pageH: document.documentElement.scrollHeight };
  })()`);
  const bad = r.scrollW > r.vw || r.over.length || r.wrappedBtns.length || r.broken.length;
  if (bad) failed = true;
  console.log(name.padEnd(8), `vw=${r.vw}`, `scrollW=${r.scrollW}`, `h1Lines=${r.h1Lines}`, `ctaBottom=${r.ctaBottom}/${height}`, r.over.length ? 'OVERFLOW ' + r.over.join(' | ') : 'no-overflow', r.wrappedBtns.length ? 'WRAPPED ' + r.wrappedBtns : '', r.broken.length ? 'BROKEN-IMG ' + r.broken : 'images-ok');
  const SLICE = 1700; // keep every image under common size limits
  for (let y = 0, n = 1; y < r.pageH; y += SLICE, n++) {
    const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: { x: 0, y, width, height: Math.min(SLICE, r.pageH - y), scale: 1 } });
    fs.writeFileSync(path.join(OUT, `${name}-${n}.png`), Buffer.from(shot.data, 'base64'));
  }
}
done();
process.exit(failed ? 1 : 0);
