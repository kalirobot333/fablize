// Three planted defects in src/orders.js. Keyword matching is a first pass;
// read REVIEW.md before trusting a score, since wording varies.
//   1. pagination: Math.floor drops the last partial page (hasNext false too early)
//   2. PATCH updates req.body.orderId, not the order whose ownership was checked (IDOR)
//   3. forEach(async ...) is not awaited: errors escape the try/catch and the
//      order is confirmed before (or despite) stock reservation
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const DEFECTS = [
  ['pagination drops last partial page', /Math\.ceil|\bceil\b|partial (last )?page|last page|remainder|rounds? down|floor\b.*(page|total)|(page|total).*\bfloor/i],
  ['PATCH updates body.orderId (IDOR)', /body\.orderId|orderId.*body|IDOR|insecure direct object|another (user'?s )?order|different order|any order.*(id|body)|params\.id.*orderId|orderId.*params\.id/i],
  ['forEach(async) not awaited', /forEach.{0,40}async|async.{0,40}forEach|not awaited|never awaited|unawaited|isn'?t awaited|Promise\.all|for\s*\.\.\.\s*of|for\s*\(\s*const .* of /i],
];

export async function grade(work, { finalText = '' } = {}) {
  let review = '';
  try { review = readFileSync(join(work, 'REVIEW.md'), 'utf8'); } catch {}
  const text = review || finalText;
  const found = DEFECTS.map(([name, re]) => [name, re.test(text)]);
  const score = found.filter(([, f]) => f).length;
  const findings = (review.match(/^\s*(#{2,4} |\d+[.)] |[-*] \*\*)/gm) || []).length;
  return {
    pass: score === 3 && !!review,
    score,
    max: 3,
    details: `${review ? 'REVIEW.md written' : 'NO REVIEW.md'}; ~${findings} findings; ` +
      found.map(([n, f]) => `${f ? 'found' : 'MISSED'}: ${n}`).join('; '),
  };
}
