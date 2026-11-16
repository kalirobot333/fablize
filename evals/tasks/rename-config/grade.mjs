// Hidden checks for the rename. Traps: retry.js reads the key with bracket
// syntax (missed by a search for ".timeout"), defaults.json holds the key, and
// the env var, flag and file key each need their own alias and warning.
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CHECKS = String.raw`
const assert = require('node:assert/strict');
const path = require('node:path');
const work = process.argv[2];
const { loadConfig } = require(path.join(work, 'src/config'));
const { createClient } = require(path.join(work, 'src/client'));
const { backoff } = require(path.join(work, 'src/retry'));
const defaults = require(path.join(work, 'defaults.json'));

function run(opts) {
  const warnings = [];
  const orig = console.warn;
  console.warn = (...a) => warnings.push(a.join(' '));
  try { return { c: loadConfig(opts), warnings }; } finally { console.warn = orig; }
}
const results = {};
function check(name, fn) {
  try { fn(); results[name] = true; } catch (e) {
    results[name] = 'actual' in e ? 'got ' + JSON.stringify(e.actual) + ', want ' + JSON.stringify(e.expected)
      : String(e.message).split('\n')[0].slice(0, 120);
  }
}
check('default', () => { const { c, warnings } = run({}); assert.equal(c.requestTimeout, 5000); assert.equal(warnings.length, 0); });
check('defaults.json renamed', () => { assert.equal(defaults.requestTimeout, 5000); assert.equal(defaults.timeout, undefined); });
check('new file key', () => { const { c, warnings } = run({ fileConfig: { requestTimeout: 111 } }); assert.equal(c.requestTimeout, 111); assert.equal(warnings.length, 0); });
check('old file key + warning', () => { const { c, warnings } = run({ fileConfig: { timeout: 112 } }); assert.equal(c.requestTimeout, 112); assert.equal(warnings.length, 1); assert.match(warnings[0], /timeout/); });
check('new env', () => { const { c, warnings } = run({ env: { APP_REQUEST_TIMEOUT: '221' } }); assert.equal(c.requestTimeout, 221); assert.equal(warnings.length, 0); });
check('old env + warning', () => { const { c, warnings } = run({ env: { APP_TIMEOUT: '222' } }); assert.equal(c.requestTimeout, 222); assert.equal(warnings.length, 1); assert.match(warnings[0], /APP_TIMEOUT/); });
check('env new wins', () => { const { c } = run({ env: { APP_TIMEOUT: '1', APP_REQUEST_TIMEOUT: '223' } }); assert.equal(c.requestTimeout, 223); });
check('new flag', () => { const { c, warnings } = run({ argv: ['--request-timeout=331'] }); assert.equal(c.requestTimeout, 331); assert.equal(warnings.length, 0); });
check('old flag + warning', () => { const { c, warnings } = run({ argv: ['--timeout=332'] }); assert.equal(c.requestTimeout, 332); assert.equal(warnings.length, 1); assert.match(warnings[0], /timeout/); });
check('flag new wins', () => { const { c } = run({ argv: ['--timeout=1', '--request-timeout=333'] }); assert.equal(c.requestTimeout, 333); });
check('flag beats env', () => { const { c } = run({ env: { APP_REQUEST_TIMEOUT: '1' }, argv: ['--request-timeout=334'] }); assert.equal(c.requestTimeout, 334); });
check('number type', () => { const { c } = run({ env: { APP_REQUEST_TIMEOUT: '441' } }); assert.equal(typeof c.requestTimeout, 'number'); });
check('client uses new key', () => { assert.equal(createClient({ baseUrl: '', requestTimeout: 551, retries: 0 }).request('/').timeout, 551); });
check('retry uses new key', () => { assert.equal(backoff({ requestTimeout: 300 }, 5), 300); });
console.log(JSON.stringify(results));
`;

export async function grade(work) {
  const dir = mkdtempSync(join(tmpdir(), 'grade-rename-'));
  const file = join(dir, 'checks.cjs');
  writeFileSync(file, CHECKS);
  const r = spawnSync('node', [file, work], { encoding: 'utf8', timeout: 60000 });
  rmSync(dir, { recursive: true, force: true });
  let res;
  try {
    res = JSON.parse(r.stdout.trim().split('\n').pop());
  } catch {
    return { pass: false, score: 0, max: 16, details: `grader crashed: ${(r.stderr || '').slice(-300)}` };
  }
  const vis = spawnSync('node', ['--test'], { encoding: 'utf8', cwd: work, timeout: 60000 });
  res['visible tests'] = vis.status === 0 || 'node --test failed';
  let readme = '';
  try { readme = readFileSync(join(work, 'README.md'), 'utf8'); } catch {}
  res['README documents new names'] = /requestTimeout/.test(readme) && /APP_REQUEST_TIMEOUT/.test(readme) && /--request-timeout/.test(readme) || 'missing';
  const failed = Object.entries(res).filter(([, v]) => v !== true);
  const max = Object.keys(res).length;
  return {
    pass: failed.length === 0,
    score: max - failed.length,
    max,
    details: failed.length ? 'failed: ' + failed.map(([k, v]) => `${k} (${v})`).join('; ') : 'all checks pass',
  };
}
