#!/usr/bin/env node
// fablize gate: refuse "done" when code changed after the last observed check.
//
// One script, registered on PostToolUse, PostToolUseFailure and Stop
// (SubagentStop inside an agent). It reads the hook JSON on stdin and decides
// from the event name. Only the Stop branch ever writes output.
//
// Facts it relies on (Claude Code hooks reference):
//   - PostToolUse fires only when the tool succeeded; failures go to
//     PostToolUseFailure. So success is never guessed from output text.
//   - Stop input carries stop_hook_active and background_tasks.
//
// It fails open: any internal error lets the turn end.

import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, extname, join } from 'node:path';

const EDIT_TOOLS = new Set(['Edit', 'Write', 'MultiEdit', 'NotebookEdit']);
const DOC_EXT = new Set(['.md', '.mdx', '.txt', '.rst', '.adoc']);
const DOC_NAMES = /^(license|changelog|readme|notice|authors|contributing)(\..*)?$/i;
const IMAGE_EXT = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp']);

// A command that, when it exits 0, counts as having observed the work.
const CHECK_RE = new RegExp(
  [
    // test runners
    String.raw`\b(pytest|vitest|jest|rspec|phpunit|tox|nox|playwright|cypress)\b`,
    String.raw`\bpython[0-9.]*\s+-m\s+(pytest|unittest|py_compile|compileall)\b`,
    String.raw`\bnode\s+--(test|check)\b`,
    String.raw`\b(go|cargo|deno|dotnet|mvn|bun)\s+(test|vet|build|check|clippy|lint|verify)\b`,
    String.raw`\b(npm|pnpm|yarn|bun)\s+(run\s+)?(test|lint|typecheck|type-check|build|check)\b`,
    String.raw`\bgradlew?\s+(test|build|check)\b`,
    String.raw`\bmake\s+(test|check|lint)\b`,
    // linters and type checkers
    String.raw`\b(tsc|eslint|ruff|flake8|mypy|pyright|shellcheck)\b`,
    // running the thing itself
    String.raw`(^|[;&|]\s*)(node|python[0-9.]*|py|bash|sh|pwsh|powershell)\s+[^-\s]\S*`,
    String.raw`\b(node\s+(-e|-p|--eval|--print)|python[0-9.]*\s+-c)\s`,
    String.raw`\b(go|cargo|deno|bun)\s+run\b`,
    // hitting a local server
    String.raw`\bcurl\b.*\b(localhost|127\.0\.0\.1)\b`,
    // headless render
    String.raw`--headless\b.*--screenshot|--screenshot\b.*--headless`,
  ].join('|'),
  'i',
);

// A Bash command that probably wrote files (used only when Claude Code does
// not report bashEditDiff).
const MUTATE_RE = new RegExp(
  [
    String.raw`\bsed\s+(-\w+\s+)*-i`,
    String.raw`\b(mv|cp|rm|tee|patch|truncate)\s`,
    String.raw`\bgit\s+(apply|checkout|restore|reset|stash|merge|rebase|cherry-pick|revert)\b`,
    String.raw`(^|[^0-9&>])>{1,2}\s*(?!/dev/null|&|\s*$)\S`,
  ].join('|'),
  'i',
);

// Browser / screen tools whose result is an observation of rendered output.
const OBSERVE_TOOL_RE = /(screenshot|snapshot|read_page|get_page_text|console_messages|zoom)/i;
const OBSERVE_ACTIONS = new Set(['screenshot', 'zoom']);

function ledgerPath(input) {
  // Per-user directory, not the shared temp dir: a predictable path in a
  // world-writable location could be pre-created or symlinked by another user.
  const dir =
    process.env.FABLIZE_GATE_DIR ||
    join(process.env.CLAUDE_CONFIG_DIR || join(homedir(), '.claude'), 'fablize-gate');
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  const key = `${input.session_id || 'no-session'}|${input.agent_id || ''}`;
  return join(dir, createHash('sha256').update(key).digest('hex').slice(0, 24) + '.json');
}

// Write to a fresh temp name (fails if it exists) and rename over the ledger,
// so a link planted at the ledger path is replaced, never followed.
function save(path, ledger) {
  const tmp = `${path}.${process.pid}.tmp`;
  writeFileSync(tmp, JSON.stringify(ledger), { flag: 'wx', mode: 0o600 });
  renameSync(tmp, path);
}

function load(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return { seq: 0, lastChange: 0, lastCheck: 0, lastFailedCheck: 0, blockedAt: 0 };
  }
}

export function pathKind(p) {
  const name = basename(String(p || ''));
  const ext = extname(name).toLowerCase();
  if (DOC_EXT.has(ext) || DOC_NAMES.test(name)) return 'docs';
  return 'code';
}

function bashChangedPaths(resp) {
  const diff = resp && typeof resp === 'object' ? resp.bashEditDiff : null;
  if (!diff || typeof diff !== 'object' || diff.unavailable || diff.skipped) return null;
  const out = [];
  for (const item of [].concat(diff.changedFiles || [], diff.files || [])) {
    if (typeof item === 'string') out.push(item);
    else if (item && typeof item === 'object') out.push(item.path || item.filePath || item.file || '');
  }
  if (out.length) return out;
  if (typeof diff.changedFiles === 'number') return diff.changedFiles > 0 ? ['unknown'] : [];
  return Array.isArray(diff.changedFiles) || Array.isArray(diff.files) ? [] : null;
}

// Returns { change: bool, check: bool } for one successful tool call.
export function classify(input) {
  const tool = String(input.tool_name || '');
  const ti = input.tool_input && typeof input.tool_input === 'object' ? input.tool_input : {};
  if (EDIT_TOOLS.has(tool)) {
    return { change: pathKind(ti.file_path || ti.notebook_path) === 'code', check: false };
  }
  if (tool === 'Bash' || tool === 'PowerShell') {
    const command = String(ti.command || '');
    const paths = bashChangedPaths(input.tool_response);
    const change = paths ? paths.some((p) => pathKind(p) === 'code') : MUTATE_RE.test(command);
    return { change, check: CHECK_RE.test(command) };
  }
  if (tool === 'Read') {
    return { change: false, check: IMAGE_EXT.has(extname(String(ti.file_path || '')).toLowerCase()) };
  }
  if (tool.startsWith('mcp__')) {
    const check = OBSERVE_TOOL_RE.test(tool) || OBSERVE_ACTIONS.has(String(ti.action || ''));
    return { change: false, check };
  }
  return { change: false, check: false };
}

export function stopDecision(input, ledger) {
  if (input.stop_hook_active) return null;
  if (Array.isArray(input.background_tasks) && input.background_tasks.length) return null;
  if (ledger.lastChange <= ledger.lastCheck) return null;
  if (ledger.blockedAt === ledger.lastChange) return null; // already asked once for this change
  const failed = ledger.lastFailedCheck > ledger.lastCheck;
  return (
    'fablize gate: code changed after the last successful check' +
    (failed ? ' (the most recent check failed)' : '') +
    '. Run the narrowest check that exercises the change (test, typecheck, run it, or render it and look) ' +
    'and report what you observed. If no check is possible, say so under "Not verified:" with the reason.'
  );
}

function main() {
  const input = JSON.parse(readFileSync(0, 'utf8') || '{}');
  const event = String(input.hook_event_name || '');
  const path = ledgerPath(input);
  const ledger = load(path);

  if (event === 'PostToolUse') {
    const { change, check } = classify(input);
    if (!change && !check) return;
    // a command that both writes and checks: the change comes first
    if (change) ledger.lastChange = ++ledger.seq;
    if (check) ledger.lastCheck = ++ledger.seq;
  } else if (event === 'PostToolUseFailure') {
    if (!classify(input).check) return;
    ledger.lastFailedCheck = ++ledger.seq;
  } else if (event === 'Stop' || event === 'SubagentStop') {
    const reason = stopDecision(input, ledger);
    if (!reason) return;
    ledger.blockedAt = ledger.lastChange;
    save(path, ledger);
    process.stdout.write(JSON.stringify({ decision: 'block', reason }));
    return;
  } else {
    return;
  }
  save(path, ledger);
}

if (process.argv[1] && import.meta.url.endsWith(basename(process.argv[1]))) {
  try {
    main();
  } catch {
    // fail open
  }
  process.exit(0);
}
