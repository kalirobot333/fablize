#!/usr/bin/env node
// Runs each task with and without fablize on the same model and effort, then
// grades the outcome and extracts process metrics.
//
//   node evals/run.mjs [--tasks a,b] [--arms fablize,baseline] [--reps 1]
//                      [--concurrency 4] [--model opus] [--effort xhigh]
//                      [--budget 4]
//
// Arms:
//   fablize   claude -p --agent fablize  (skill preloaded, gate attached)
//   baseline  claude -p with the Skill tool disabled, so it cannot load fablize
// Both disable the Agent tool so neither can hand the task to a subagent.
// Both load your normal user settings and CLAUDE.md: the comparison is
// "your setup" versus "your setup plus fablize".
//
// Output: <temp>/fablize-evals/<timestamp>/ (or $FABLIZE_EVAL_OUT) with each
// run's work folder, stream log and grade; summary.md and results.json are
// also copied to evals/results/<timestamp>/.

import { spawn } from 'node:child_process';
import { mkdirSync, openSync, closeSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { metrics } from './lib/metrics.mjs';
import { EVALS, grader, listTasks, prepare, prompt } from './lib/tasks.mjs';

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, all) => (a.startsWith('--') ? [...acc, [a.slice(2), all[i + 1]]] : acc), []),
);
const tasks = listTasks(args.tasks?.split(','));
const arms = (args.arms || 'fablize,baseline').split(',');
const reps = Number(args.reps || 1);
const concurrency = Number(args.concurrency || 4);
const model = args.model || 'opus';
const effort = args.effort || 'xhigh';
const budget = args.budget || '4';

const ALLOWED = 'Bash PowerShell Edit Write MultiEdit Read Glob Grep NotebookEdit mcp__playwright';
const ARM_FLAGS = {
  fablize: ['--agent', 'fablize', '--disallowedTools', 'Agent'],
  baseline: ['--disallowedTools', 'Agent', 'Skill'],
};

const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
// Outside the repo, so the agent cannot find the graders or reference solutions.
const out = join(process.env.FABLIZE_EVAL_OUT || join(tmpdir(), 'fablize-evals'), stamp);
mkdirSync(out, { recursive: true });

const jobs = [];
for (const task of tasks) for (const arm of arms) for (let rep = 1; rep <= reps; rep++) jobs.push({ task, arm, rep });

function runClaude(job) {
  const dir = join(out, job.task, `${job.arm}-${job.rep}`);
  const work = join(dir, 'work');
  prepare(job.task, work);
  const streamFile = join(dir, 'stream.jsonl');
  const argv = [
    '-p', prompt(job.task),
    '--model', model, '--effort', effort,
    '--output-format', 'stream-json', '--verbose',
    '--no-session-persistence', '--max-budget-usd', budget,
    '--allowedTools', ...ALLOWED.split(' '),
    ...ARM_FLAGS[job.arm],
  ];
  const so = openSync(streamFile, 'w');
  const se = openSync(join(dir, 'stderr.txt'), 'w');
  return new Promise((resolve) => {
    const started = Date.now();
    const p = spawn('claude', argv, { cwd: work, stdio: ['ignore', so, se] });
    const timer = setTimeout(() => p.kill(), 20 * 60 * 1000);
    p.on('close', (code) => {
      clearTimeout(timer);
      closeSync(so); closeSync(se);
      resolve({ dir, work, streamFile, code, wallS: Math.round((Date.now() - started) / 1000) });
    });
  });
}

async function runJob(job) {
  const r = await runClaude(job);
  const m = metrics(r.streamFile);
  const grade = await grader(job.task);
  let g;
  try { g = await grade(r.work, { finalText: m.finalText }); } catch (e) { g = { pass: false, score: 0, max: 0, details: `grader error: ${e.message}` }; }
  const rec = { ...job, exit: r.code, wallS: r.wallS, ...g, ...m };
  writeFileSync(join(r.dir, 'result.json'), JSON.stringify(rec, null, 2));
  console.log(`${job.task.padEnd(16)} ${job.arm.padEnd(9)} #${job.rep}  ${g.pass ? 'PASS' : 'fail'} ${g.score}/${g.max}  $${m.costUsd?.toFixed(2)}  ${r.wallS}s  gate:${m.gateBlocks}  ${g.details}`);
  return rec;
}

const results = [];
let next = 0;
await Promise.all(Array.from({ length: Math.min(concurrency, jobs.length) }, async () => {
  while (next < jobs.length) results.push(await runJob(jobs[next++]));
}));

results.sort((a, b) => a.task.localeCompare(b.task) || a.arm.localeCompare(b.arm) || a.rep - b.rep);
writeFileSync(join(out, 'results.json'), JSON.stringify(results.map(({ finalText, ...r }) => r), null, 2));

const yes = (b) => (b ? 'yes' : 'no');
const rows = results.map((r) =>
  `| ${r.task} | ${r.arm} | ${r.rep} | ${r.pass ? 'PASS' : 'fail'} | ${r.score}/${r.max} | ${yes(r.checkedAfterLastChange)} | ${r.observations} | ${yes(r.verifiedLine)} | ${r.gateBlocks} | ${r.toolCalls} | $${(r.costUsd ?? 0).toFixed(2)} | ${r.wallS}s |`);
const byArm = arms.map((arm) => {
  const rs = results.filter((r) => r.arm === arm);
  const sum = (f) => rs.reduce((s, r) => s + (f(r) || 0), 0);
  return `| ${arm} | ${sum((r) => r.pass)}/${rs.length} | ${sum((r) => r.score)}/${sum((r) => r.max)} | ${sum((r) => r.checkedAfterLastChange)}/${rs.length} | ${sum((r) => r.verifiedLine)}/${rs.length} | $${sum((r) => r.costUsd).toFixed(2)} | ${Math.round(sum((r) => r.wallS) / Math.max(1, rs.length))}s |`;
});
const md = `# Eval run ${stamp}

Model \`${model}\`, effort \`${effort}\`, ${reps} rep(s) per task and arm.

| Arm | Passed | Checks scored | Checked after last change | "Verified:" line | Cost | Avg time |
|---|---|---|---|---|---|---|
${byArm.join('\n')}

| Task | Arm | Rep | Result | Score | Checked after last change | Observations | "Verified:" | Gate blocks | Tool calls | Cost | Time |
|---|---|---|---|---|---|---|---|---|---|---|---|
${rows.join('\n')}

## Grader details

${results.map((r) => `- **${r.task} / ${r.arm} #${r.rep}:** ${r.details}`).join('\n')}
`;
writeFileSync(join(out, 'summary.md'), md);
const keep = join(EVALS, 'results', stamp);
mkdirSync(keep, { recursive: true });
writeFileSync(join(keep, 'summary.md'), md);
writeFileSync(join(keep, 'results.json'), JSON.stringify(results.map(({ finalText, ...r }) => r), null, 2));
console.log(`\nRaw runs: ${out}\nSummary:  ${join(keep, 'summary.md')}`);
