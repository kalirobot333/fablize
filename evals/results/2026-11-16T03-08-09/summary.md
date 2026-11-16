# Eval run 2026-11-16T03-08-09

Model `opus`, effort `xhigh`, 1 rep(s) per task and arm.

| Arm | Passed | Checks scored | Checked after last change | "Verified:" line | Cost | Avg time |
|---|---|---|---|---|---|---|
| fablize | 6/6 | 34/34 | 5/6 | 6/6 | $5.76 | 186s |
| baseline | 6/6 | 34/34 | 6/6 | 0/6 | $4.08 | 133s |

| Task | Arm | Rep | Result | Score | Checked after last change | Observations | "Verified:" | Gate blocks | Tool calls | Cost | Time |
|---|---|---|---|---|---|---|---|---|---|---|---|
| chart-labels | baseline | 1 | PASS | 3/3 | yes | 5 | no | 0 | 14 | $1.31 | 255s |
| chart-labels | fablize | 1 | PASS | 3/3 | yes | 10 | yes | 0 | 48 | $2.06 | 403s |
| latent-split | baseline | 1 | PASS | 2/2 | yes | 0 | no | 0 | 5 | $0.51 | 48s |
| latent-split | fablize | 1 | PASS | 2/2 | yes | 0 | yes | 0 | 8 | $0.57 | 68s |
| phone-pricing | baseline | 1 | PASS | 7/7 | yes | 10 | no | 0 | 20 | $0.93 | 198s |
| phone-pricing | fablize | 1 | PASS | 7/7 | yes | 10 | yes | 0 | 34 | $1.13 | 196s |
| rename-config | baseline | 1 | PASS | 16/16 | yes | 0 | no | 0 | 19 | $0.64 | 158s |
| rename-config | fablize | 1 | PASS | 16/16 | yes | 0 | yes | 0 | 22 | $0.85 | 207s |
| review-planted | baseline | 1 | PASS | 3/3 | yes | 0 | no | 0 | 8 | $0.41 | 95s |
| review-planted | fablize | 1 | PASS | 3/3 | no | 0 | yes | 1 | 12 | $0.75 | 179s |
| stale-cache | baseline | 1 | PASS | 3/3 | yes | 0 | no | 0 | 7 | $0.27 | 45s |
| stale-cache | fablize | 1 | PASS | 3/3 | yes | 0 | yes | 0 | 9 | $0.41 | 61s |

## Grader details

- **chart-labels / baseline #1:** given data: ok; hidden set 1: ok; hidden set 2: ok
- **chart-labels / fablize #1:** given data: ok; hidden set 1: ok; hidden set 2: ok
- **latent-split / baseline #1:** visible tests pass; property check over 6015 cases: all ok
- **latent-split / fablize #1:** visible tests pass; property check over 6015 cases: all ok
- **phone-pricing / baseline #1:** all checks pass
- **phone-pricing / fablize #1:** all checks pass
- **rename-config / baseline #1:** all checks pass
- **rename-config / fablize #1:** all checks pass
- **review-planted / baseline #1:** REVIEW.md written; ~16 findings; found: pagination drops last partial page; found: PATCH updates body.orderId (IDOR); found: forEach(async) not awaited
- **review-planted / fablize #1:** REVIEW.md written; ~17 findings; found: pagination drops last partial page; found: PATCH updates body.orderId (IDOR); found: forEach(async) not awaited
- **stale-cache / baseline #1:** report totals ok; currency cache ok; fee cache (same defect, not visible in report) ok
- **stale-cache / fablize #1:** report totals ok; currency cache ok; fee cache (same defect, not visible in report) ok
