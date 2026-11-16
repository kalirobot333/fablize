#!/usr/bin/env node
// Checks every grader: the untouched fixture must FAIL and the fixture with
// the reference solution applied must PASS. Run after changing any task.
//   node evals/validate.mjs [task ...]
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { grader, listTasks, prepare } from './lib/tasks.mjs';

const root = mkdtempSync(join(tmpdir(), 'fablize-validate-'));
let ok = true;
for (const task of listTasks(process.argv.slice(2))) {
  const grade = await grader(task);
  for (const reference of [false, true]) {
    const dir = join(root, `${task}-${reference ? 'ref' : 'fixture'}`);
    prepare(task, dir, { reference });
    const r = await grade(dir, { finalText: '' });
    const good = r.pass === reference;
    ok &&= good;
    console.log(`${good ? 'ok  ' : 'BAD '} ${task.padEnd(16)} ${reference ? 'reference' : 'fixture  '} ${r.pass ? 'PASS' : 'fail'} ${r.score}/${r.max}  ${r.details}`);
  }
}
rmSync(root, { recursive: true, force: true });
process.exit(ok ? 0 : 1);
