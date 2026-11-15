#!/usr/bin/env node
// Install the fablize skill and agent at user level.
//
//   node scripts/install.mjs              install (refuses to overwrite changed files)
//   node scripts/install.mjs --force      install, overwriting
//   node scripts/install.mjs --uninstall  remove both
//
// Writes only <config>/skills/fablize/ and <config>/agents/fablize.md, where
// <config> is $CLAUDE_CONFIG_DIR or ~/.claude. It does not touch settings.json
// or CLAUDE.md.

import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = join(dirname(fileURLToPath(import.meta.url)), '..');
const config = process.env.CLAUDE_CONFIG_DIR || join(homedir(), '.claude');
const skillDir = join(config, 'skills', 'fablize');
const agentFile = join(config, 'agents', 'fablize.md');
const args = new Set(process.argv.slice(2));

if (args.has('--uninstall')) {
  rmSync(skillDir, { recursive: true, force: true });
  rmSync(agentFile, { force: true });
  console.log(`Removed ${skillDir}\nRemoved ${agentFile}`);
  process.exit(0);
}

// Hook commands in the repo use the plugin placeholder; at user level they
// need the real path. Forward slashes work in Git Bash and PowerShell.
const placeholder = '${CLAUDE_PLUGIN_ROOT}/skills/fablize';
const installedPath = skillDir.replace(/\\/g, '/');
const withPath = (file) => readFileSync(join(repo, file), 'utf8').split(placeholder).join(installedPath);

const targets = [
  [join(skillDir, 'SKILL.md'), withPath('skills/fablize/SKILL.md')],
  [join(skillDir, 'scripts', 'gate.mjs'), readFileSync(join(repo, 'skills/fablize/scripts/gate.mjs'), 'utf8')],
  [agentFile, withPath('agents/fablize.md')],
];

const changed = targets.filter(([path, text]) => existsSync(path) && readFileSync(path, 'utf8') !== text);
if (changed.length && !args.has('--force')) {
  console.error('These files exist and differ from the repo version:');
  for (const [path] of changed) console.error(`  ${path}`);
  console.error('Re-run with --force to overwrite them.');
  process.exit(1);
}

for (const [path, text] of targets) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text);
  console.log(`Wrote ${path}`);
}
console.log('\nInstalled. Start a new Claude Code session, then use /fablize or the fablize agent.');
