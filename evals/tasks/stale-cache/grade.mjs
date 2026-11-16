// Hidden checks: every (key, day) combination in both call orders, for BOTH
// cached lookups. The visible report only exercises the currency cache, so a
// fix that misses the identical fee-cache defect passes report.py but fails here.
import { spawnSync } from 'node:child_process';

const PY = String.raw`
import importlib, json, logging, sys
logging.disable(logging.CRITICAL)
sys.path.insert(0, sys.argv[1])
import rates
def fresh():
    return importlib.reload(rates)
days = sorted(rates._SERVICE_RATES)
ok_rates = ok_fees = True
for order in (days, list(reversed(days))):
    r = fresh()
    for day in order:
        for cur, want in r._SERVICE_RATES[day].items():
            if abs(r.rate_to_usd(cur, day) - want) > 1e-12: ok_rates = False
    r = fresh()
    for day in order:
        for reg, want in r._SERVICE_FEES[day].items():
            if abs(r.fee_rate(reg, day) - want) > 1e-12: ok_fees = False
fresh()
import report
report = importlib.reload(report)
totals = report.daily_totals(report.TRANSACTIONS)
ok_report = totals == {"2026-03-01": 160.12, "2026-03-02": 98.50}
print(json.dumps({"rates": ok_rates, "fees": ok_fees, "report": ok_report}))
`;

export async function grade(work) {
  const r = spawnSync('python', ['-I', '-c', PY, work], { encoding: 'utf8', cwd: work, timeout: 60000 });
  let res;
  try {
    res = JSON.parse(r.stdout.trim().split('\n').pop());
  } catch {
    return { pass: false, score: 0, max: 3, details: `grader crashed: ${(r.stderr || '').slice(-300)}` };
  }
  const score = [res.report, res.rates, res.fees].filter(Boolean).length;
  return {
    pass: score === 3,
    score,
    max: 3,
    details: `report totals ${res.report ? 'ok' : 'WRONG'}; currency cache ${res.rates ? 'ok' : 'WRONG'}; fee cache (same defect, not visible in report) ${res.fees ? 'ok' : 'WRONG'}`,
  };
}
