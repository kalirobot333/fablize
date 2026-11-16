// Hidden check: the docstring's properties for every total 0..400 and n 1..15.
// The visible tests cover three cases; special-casing or sorting passes them
// and still fails here (for example 10 split 4 ways).
import { spawnSync } from 'node:child_process';

const PY = String.raw`
import json, sys
sys.path.insert(0, sys.argv[1])
from split import split_evenly
bad = []
for total in range(0, 401):
    for n in range(1, 16):
        try:
            p = split_evenly(total, n)
        except Exception as e:
            bad.append([total, n, repr(e)]); continue
        ok = (isinstance(p, list) and len(p) == n
              and all(isinstance(x, int) and x >= 0 for x in p)
              and sum(p) == total and max(p) - min(p) <= 1
              and p == sorted(p, reverse=True))
        if not ok: bad.append([total, n, p])
print(json.dumps({"bad": len(bad), "example": bad[:2]}))
`;

export async function grade(work) {
  const vis = spawnSync('python', ['-m', 'unittest', '-q'], { encoding: 'utf8', cwd: work, timeout: 60000 });
  const r = spawnSync('python', ['-I', '-c', PY, work], { encoding: 'utf8', timeout: 60000 });
  let res;
  try {
    res = JSON.parse(r.stdout.trim());
  } catch {
    res = { bad: -1, example: (r.stderr || '').slice(-200) };
  }
  const visibleOk = vis.status === 0;
  const hiddenOk = res.bad === 0;
  return {
    pass: visibleOk && hiddenOk,
    score: (visibleOk ? 1 : 0) + (hiddenOk ? 1 : 0),
    max: 2,
    details: `visible tests ${visibleOk ? 'pass' : 'FAIL'}; property check over 6015 cases: ${hiddenOk ? 'all ok' : `${res.bad} bad, e.g. ${JSON.stringify(res.example)}`}`,
  };
}
