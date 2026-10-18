// Captures draft Play Store screenshots from the web build at phone resolution (1080 px wide) by
// driving headless Chrome over the DevTools protocol. Needs the Expo web server on :8081
// (`npm run mobile -- --web` or the mobile-web-preview launch config).
// Usage: node scripts/store-screenshots.mjs [outDir]
// For final store assets, prefer captures from an installed preview build on a real phone.
import { spawn } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CHROME = process.env.CHROME ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const APP = process.env.APP_URL ?? 'http://localhost:8081';
const OUT = process.argv[2] ?? 'docs/play-store/screenshots';
const PORT = 9333;
// 412 x 822 dp at 2.625x = 1082 x 2158 px (portrait, within Play's 2:1 limit).
const WIDTH = 412;
const HEIGHT = 822;
const SCALE = 2.625;

mkdirSync(OUT, { recursive: true });
const profile = mkdtempSync(join(tmpdir(), 'laas-shots-'));
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, '--hide-scrollbars', 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let targets;
for (let i = 0; i < 50 && !targets; i++) {
  await sleep(200);
  try {
    targets = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
  } catch {}
}
const ws = new WebSocket(targets.find((t) => t.type === 'page').webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r, { once: true }));
let seq = 0;
const pending = new Map();
ws.addEventListener('message', (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) {
    pending.get(m.id)(m);
    pending.delete(m.id);
  }
});
const send = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const id = ++seq;
    pending.set(id, (m) => (m.error ? reject(new Error(`${method}: ${m.error.message}`)) : resolve(m.result)));
    ws.send(JSON.stringify({ id, method, params }));
  });
const evaluate = async (expression) => (await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })).result.value;

await send('Emulation.setDeviceMetricsOverride', { width: WIDTH, height: HEIGHT, deviceScaleFactor: SCALE, mobile: true });
await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'dark' }] });

async function go(path) {
  await send('Page.navigate', { url: APP + path });
  await sleep(4500);
}

/** Clicks the visible element whose text matches exactly, using real pointer events. */
async function click(text) {
  const box = await evaluate(`(() => {
    const els = [...document.querySelectorAll('[role="button"],[role="link"],[role="checkbox"],button,a,[tabindex]')];
    const el = els.find((e) => e.innerText && e.innerText.trim() === ${JSON.stringify(text)} && e.getBoundingClientRect().height > 0);
    if (!el) return null;
    el.scrollIntoView({ block: 'center' });
    const r = el.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  })()`);
  if (!box) throw new Error(`Not found: ${text}`);
  for (const type of ['mousePressed', 'mouseReleased']) await send('Input.dispatchMouseEvent', { type, x: box.x, y: box.y, button: 'left', clickCount: 1 });
  await sleep(700);
}

async function type(selector, text) {
  await evaluate(`document.querySelector(${JSON.stringify(selector)}).focus()`);
  await send('Input.insertText', { text });
  await sleep(300);
}

async function shot(name) {
  await evaluate('window.scrollTo(0, 0)');
  await sleep(500);
  const { data } = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(join(OUT, `${name}.png`), Buffer.from(data, 'base64'));
  console.log('saved', name);
}

try {
  // Onboarding (stored only in this throwaway browser profile).
  await go('/');
  await type('input', 'Alex');
  await click('Continue');
  await click('10 min');
  await click('Continue');
  await click('Continue');
  await click('No reminders');
  await click('Start learning');
  await sleep(1500);

  await go('/');
  await shot('01-home');
  await go('/learn');
  await shot('02-learn');
  await go('/lesson/b-prompt-injection');
  await shot('03-lesson');
  await go('/lab/lab-prompt-injection');
  await shot('04-lab');
  await go('/tutor');
  await click('What is MCP tool poisoning?');
  await sleep(1200);
  await shot('05-tutor');
  await go('/practice');
  await shot('06-practice');
  await go('/interview');
  await shot('07-interview');
} finally {
  ws.close();
  chrome.kill();
}
