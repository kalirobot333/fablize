// Run: node --test
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const GATE = join(dirname(fileURLToPath(import.meta.url)), '..', 'skills', 'fablize', 'scripts', 'gate.mjs');

function session() {
  const dir = mkdtempSync(join(tmpdir(), 'fablize-test-'));
  const send = (payload, raw) => {
    const r = spawnSync('node', [GATE], {
      input: raw ?? JSON.stringify({ session_id: 's1', ...payload }),
      env: { ...process.env, FABLIZE_GATE_DIR: dir },
      encoding: 'utf8',
    });
    assert.equal(r.status, 0, r.stderr);
    return r.stdout ? JSON.parse(r.stdout) : null;
  };
  return {
    send,
    ok: (tool_name, tool_input, tool_response = {}) =>
      send({ hook_event_name: 'PostToolUse', tool_name, tool_input, tool_response }),
    fail: (tool_name, tool_input) =>
      send({ hook_event_name: 'PostToolUseFailure', tool_name, tool_input, error: 'Exit code 1' }),
    stop: (extra = {}) => send({ hook_event_name: 'Stop', stop_hook_active: false, ...extra }),
  };
}

const edit = (s, file = 'src/app.js') => s.ok('Edit', { file_path: file });
const bash = (s, command, resp) => s.ok('Bash', { command }, resp);

test('edit then stop blocks', () => {
  const s = session();
  edit(s);
  const out = s.stop();
  assert.equal(out.decision, 'block');
  assert.match(out.reason, /fablize gate/);
});

test('edit, passing test, stop allows', () => {
  const s = session();
  edit(s);
  bash(s, 'npm test');
  assert.equal(s.stop(), null);
});

test('test before edit does not count', () => {
  const s = session();
  bash(s, 'npm test');
  edit(s);
  assert.equal(s.stop().decision, 'block');
});

test('failed test still blocks and says so', () => {
  const s = session();
  edit(s);
  s.fail('Bash', { command: 'pytest -q' });
  const out = s.stop();
  assert.equal(out.decision, 'block');
  assert.match(out.reason, /most recent check failed/);
});

test('docs-only change allows', () => {
  const s = session();
  edit(s, 'README.md');
  edit(s, 'docs/guide.txt');
  assert.equal(s.stop(), null);
});

test('stop_hook_active allows', () => {
  const s = session();
  edit(s);
  assert.equal(s.stop({ stop_hook_active: true }), null);
});

test('blocks only once per change', () => {
  const s = session();
  edit(s);
  assert.equal(s.stop().decision, 'block');
  assert.equal(s.stop(), null);
  edit(s);
  assert.equal(s.stop().decision, 'block');
});

test('waiting on background tasks allows', () => {
  const s = session();
  edit(s);
  assert.equal(s.stop({ background_tasks: [{ id: 't1', type: 'shell' }] }), null);
});

test('malformed input fails open', () => {
  const s = session();
  assert.equal(s.send(null, 'not json'), null);
  assert.equal(s.send(null, ''), null);
});

test('output text mentioning failure has no effect', () => {
  const s = session();
  bash(s, 'cat notes.log', { stdout: 'build failed\nTraceback\nerror: failure' });
  assert.equal(s.stop(), null);
});

test('loose words are not checks', () => {
  const s = session();
  edit(s);
  bash(s, 'ls build/');
  bash(s, 'git status --short # check');
  bash(s, 'curl https://example.com');
  assert.equal(s.stop().decision, 'block');
});

test('running the script counts as a check', () => {
  const s = session();
  edit(s, 'tool.py');
  bash(s, 'python tool.py --dry-run');
  assert.equal(s.stop(), null);
});

test('an inline one-liner that runs the code counts as a check', () => {
  const s = session();
  edit(s, 'calc.js');
  bash(s, `node -e "console.log(require('./calc.js').add(2,3))"`);
  assert.equal(s.stop(), null);
});

test('screenshot or image read counts as a check', () => {
  const a = session();
  edit(a, 'index.html');
  a.ok('mcp__playwright__browser_take_screenshot', {});
  assert.equal(a.stop(), null);

  const b = session();
  edit(b, 'index.html');
  b.ok('Read', { file_path: 'C:/tmp/shot.png' });
  assert.equal(b.stop(), null);

  const c = session();
  edit(c, 'index.html');
  c.ok('Read', { file_path: 'index.html' });
  assert.equal(c.stop().decision, 'block');
});

test('bash file writes count as changes', () => {
  const a = session();
  bash(a, "sed -i 's/a/b/' src/app.js");
  assert.equal(a.stop().decision, 'block');

  const b = session();
  bash(b, 'echo "x = 1" > config.py');
  assert.equal(b.stop().decision, 'block');

  const c = session();
  bash(c, 'npm test 2>&1 | tail -5');
  bash(c, 'ls > /dev/null');
  assert.equal(c.stop(), null);
});

test('bashEditDiff is preferred over guessing', () => {
  const a = session();
  bash(a, 'node gen.js', { bashEditDiff: { changedFiles: ['README.md'] } });
  assert.equal(a.stop(), null);

  const b = session();
  bash(b, 'npx prettier -w .', { bashEditDiff: { changedFiles: ['src/a.ts'] } });
  assert.equal(b.stop().decision, 'block');
});

test('a command that writes and checks passes', () => {
  const s = session();
  bash(s, 'npm run build > build.log');
  assert.equal(s.stop(), null);
});

test('subagent ledger is separate from the session', () => {
  const s = session();
  s.send({ hook_event_name: 'PostToolUse', agent_id: 'a1', tool_name: 'Edit', tool_input: { file_path: 'x.js' } });
  assert.equal(s.stop(), null);
  assert.equal(s.send({ hook_event_name: 'SubagentStop', agent_id: 'a1' }).decision, 'block');
});
