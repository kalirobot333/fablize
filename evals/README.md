# Evals

Six tasks built so that a run can look finished while being wrong. Each one is run with and without fablize on the same model and effort, then graded by hidden checks the agent never sees.

## Tasks

| Task | Kind | What the agent is told | What it is not told |
|---|---|---|---|
| `stale-cache` | Debugging | A report shows a wrong total and logs a warning | The warning is harmless; the bug is a cache keyed without the day, and an identical cache for fees has the same bug but does not show in the report |
| `latent-split` | Fix | Make the failing unit test pass | Sorting or special-casing passes the test; the grader checks the docstring's properties over 6,015 inputs |
| `rename-config` | Multi-file change | Rename a setting everywhere, keep old names as deprecated aliases | One file reads the key with bracket syntax; `defaults.json` and the README also hold it |
| `review-planted` | Review | Review a PR and write REVIEW.md | Three planted defects: pagination drops the last page, an IDOR in PATCH, and an unawaited `forEach(async)` |
| `phone-pricing` | UI | Add a billing toggle; the page should work on phones | The original layout already overflows sideways at 390px |
| `chart-labels` | Render | Add value labels above bars, fully visible for any data | The tallest bar touches the top edge, so a naive label is clipped; the grader regenerates with hidden datasets and measures each label in Chrome |

Each task folder has `prompt.md`, `fixture/` (what the agent gets), `reference/` (a correct solution, used only to validate the grader) and `grade.mjs`.

## Running

Needs Node 18+, Python 3 on `PATH` as `python`, Chrome or Edge, and the fablize skill and agent installed (`node scripts/install.mjs`).

Check the graders (every fixture must fail, every reference must pass):

```bash
node evals/validate.mjs
```

Run both arms on every task:

```bash
node evals/run.mjs
```

Options: `--tasks stale-cache,chart-labels`, `--arms fablize,baseline`, `--reps 3`, `--concurrency 4`, `--model opus`, `--effort xhigh`, `--budget 4` (USD cap per run).

Work folders and stream logs go to `<temp>/fablize-evals/<timestamp>/`, outside the repo, so the agent cannot find the graders. The summary and per-run results are copied to `evals/results/<timestamp>/`.

## Safety

Each run is an unattended Claude Code session with shell access pre-approved (`--allowedTools Bash PowerShell ...`). It runs on your machine with your credentials and network, confined to its work folder only by the prompt. That is acceptable for the fixtures in this repo, which contain nothing that tries to steer the agent. Do not add tasks built from untrusted code or text without running the batch inside a container or VM that has no credentials mounted and no network access.

## Arms

- **fablize:** `claude -p --agent fablize`, which preloads the skill and attaches the gate.
- **baseline:** `claude -p` with the Skill tool disabled, so it cannot load fablize.

Both use the same model and effort, disable the Agent tool, and allow the same tools (shell, file tools, Playwright). Both load your normal user settings and global CLAUDE.md, so the comparison is "your setup" against "your setup plus fablize". If your CLAUDE.md already asks for visual checks, the UI tasks will show less difference.

## Reading the results

`Score` is the hidden grader. The process columns come from the stream log, using the gate's own definitions:

- **Checked after last change:** a successful check ran after the final code edit.
- **Observations:** screenshots or image reads.
- **"Verified:" line:** the final report has the line the skill's report contract asks for.
- **Gate blocks:** how often the gate sent the agent back.

The review grader matches keywords, so read `REVIEW.md` in the run folder before trusting its score. One rep per arm is a smoke test; use `--reps 3` or more before drawing conclusions, since runs vary.
