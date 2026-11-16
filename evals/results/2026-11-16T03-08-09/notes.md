# Notes on run 2026-11-16T03-08-09

Opus 5.5 at `xhigh` effort, one rep per task and arm, the owner's normal user settings and global CLAUDE.md loaded in both arms.

## Result

- **Outcome: no difference.** Both arms passed all 6 tasks with full hidden-check scores (34/34 each), including the traps: both fixed the fee cache that the report never showed, both wrote the general `divmod` split, both found the bracket-syntax read in `retry.js`, both fixed the 390px overflow, both left room for the tallest chart label, and both found all three planted review defects.
- **Process: baseline already checks its work.** It ran a successful check after its last change in 6 of 6 runs. On the UI tasks it took as many screenshots as fablize, which is probably the global CLAUDE.md rule about visual passes.
- **The one consistent difference is the report.** fablize ended 6 of 6 reports with `Verified:` / `Not verified:` lines; baseline 0 of 6.
- **Cost: fablize was 41% more expensive and 40% slower** ($5.76 against $4.08; 186s against 133s average). On `chart-labels` it made 48 tool calls against 14.

## Gate false positive (fixed after this run)

On `review-planted` the gate blocked once. The agent had run a throwaway Node script through a heredoc (`node - <<'EOF'`); the gate read the script's `=>` arrows as file redirects and did not count `node -` as a check. Fixed in the gate (heredoc bodies are ignored when looking for writes, `node -` and `python -` count as checks) with three new tests. Re-scoring this run's stream with the fixed classifier shows no change and three checks.

## What this means

These tasks are within what Opus 5.5 at `xhigh` already does carefully, so the eval hits a ceiling and cannot show a benefit. On this evidence fablize adds cost and a report format, not correctness. To find out whether it helps anywhere:

1. Run at the effort you actually use day to day (`--effort high` or `medium`), where corner-cutting is more likely.
2. Add harder tasks: longer multi-step work, bugs that need several hypotheses, real repositories.
3. Use `--reps 3` or more per arm; one rep cannot separate a real effect from run-to-run variation.
