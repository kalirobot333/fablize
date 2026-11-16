// Minimal headless Chrome driver over the DevTools protocol (no dependencies).
// Used by graders that need to see a rendered page.

import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const CANDIDATES = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
].filter(Boolean);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function openBrowser() {
  const exe = CANDIDATES.find((p) => existsSync(p));
  if (!exe) throw new Error('No Chrome/Edge found; set CHROME_PATH');
  const profile = mkdtempSync(join(tmpdir(), 'fablize-eval-chrome-'));
  const proc = spawn(exe, [
    '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank',
  ], { stdio: 'ignore' });

  let port;
  for (let i = 0; i < 100 && !port; i++) {
    await sleep(100);
    try { port = readFileSync(join(profile, 'DevToolsActivePort'), 'utf8').split('\n')[0].trim(); } catch {}
  }
  if (!port) { proc.kill(); throw new Error('Chrome did not start'); }

  const close = async () => {
    proc.kill();
    await sleep(300);
    try { rmSync(profile, { recursive: true, force: true }); } catch {}
  };
  return { port, close };
}

export async function openPage(browser) {
  const res = await fetch(`http://127.0.0.1:${browser.port}/json/new?about:blank`, { method: 'PUT' });
  const { webSocketDebuggerUrl } = await res.json();
  const ws = new WebSocket(webSocketDebuggerUrl);
  await new Promise((ok, fail) => { ws.onopen = ok; ws.onerror = fail; });
  let id = 0;
  const pending = new Map();
  const listeners = [];
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      const { ok, fail } = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? fail(new Error(msg.error.message)) : ok(msg.result);
    } else if (msg.method) {
      for (const l of listeners) l(msg);
    }
  };
  const send = (method, params = {}) => new Promise((ok, fail) => {
    const n = ++id;
    pending.set(n, { ok, fail });
    ws.send(JSON.stringify({ id: n, method, params }));
  });
  const errors = [];
  listeners.push((m) => {
    if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails?.exception?.description || 'exception');
  });
  await send('Runtime.enable');
  await send('Page.enable');

  const page = {
    errors,
    async viewport(width, height, mobile = false) {
      await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: mobile ? 3 : 1, mobile });
      await send('Emulation.setTouchEmulationEnabled', { enabled: mobile });
    },
    async goto(filePath) {
      const loaded = new Promise((r) => listeners.push((m) => m.method === 'Page.loadEventFired' && r()));
      await send('Page.navigate', { url: pathToFileURL(filePath).href });
      await Promise.race([loaded, sleep(5000)]);
      await sleep(200);
    },
    // Runs a grader-written expression inside the headless page (CDP
    // Runtime.evaluate). Not JS eval(); only grader code is passed here.
    async evaluate(expression) {
      const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
      if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || 'eval failed');
      return r.result.value;
    },
    close() { ws.close(); },
  };
  return page;
}
