import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const EVALS = join(dirname(fileURLToPath(import.meta.url)), '..');
export const TASKS = join(EVALS, 'tasks');

export function listTasks(only) {
  const all = readdirSync(TASKS, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort();
  return only?.length ? all.filter((t) => only.includes(t)) : all;
}

export function prompt(task) {
  return readFileSync(join(TASKS, task, 'prompt.md'), 'utf8').trim();
}

// Fresh copy of the fixture, optionally with the reference solution on top.
export function prepare(task, dest, { reference = false } = {}) {
  rmSync(dest, { recursive: true, force: true });
  mkdirSync(dest, { recursive: true });
  cpSync(join(TASKS, task, 'fixture'), dest, { recursive: true });
  const ref = join(TASKS, task, 'reference');
  if (reference && existsSync(ref)) cpSync(ref, dest, { recursive: true });
}

export async function grader(task) {
  return (await import(pathToFileURL(join(TASKS, task, 'grade.mjs')).href)).grade;
}
