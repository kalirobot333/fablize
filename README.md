# fablize (Opus harness fork)

A Claude Code skill, agent and gate for doing careful work on Opus when Fable is not available.

This is a fork of [fivetaku/fablize](https://github.com/fivetaku/fablize), cut down to the parts that hold up and rebuilt so they work on Windows, macOS and Linux with only Node installed.

## What it does

- **A skill (`/fablize`)** with short procedures: investigate a bug to its root cause, run or render the result and look at it, track multi-step work, and end every report with what was verified and what was not.
- **An agent (`fablize`)** pinned to Opus at high effort with the skill preloaded, for handing off a whole task or a stuck slice.
- **A gate** that runs while the skill or agent is active. When the model tries to finish after changing code and no check has succeeded since the last change, the gate sends it back once.

## What it does not do

It does not make Opus as capable as Fable. It makes the model follow a procedure and stops it from reporting "done" without an observed check. Whether that closes the gap on your tasks is something to measure on your own work; this repo makes no measured claim about it.

## Install

Needs Node 18 or later and Claude Code.

```bash
git clone https://github.com/kalirobot333/fablize
```

```bash
node fablize/scripts/install.mjs
```

This writes `~/.claude/skills/fablize/` and `~/.claude/agents/fablize.md` (or under `$CLAUDE_CONFIG_DIR`). It does not edit `settings.json` or `CLAUDE.md`. Start a new session afterwards.

Remove it with:

```bash
node fablize/scripts/install.mjs --uninstall
```

The repo also keeps the plugin manifest, so `/plugin marketplace add kalirobot333/fablize` should load the skill and agent. That path is untested in this fork, and Claude Code ignores hooks declared in a plugin agent's frontmatter, so the agent would run without the gate.

## Use

- In a session: `/fablize`, or say "fablize this" or "see it through". The gate stays on for the rest of that session.
- As an agent: `@agent-fablize <task>`, "use the fablize agent to ...", or `claude --agent fablize` to run a whole session as it.

## How the gate decides

`skills/fablize/scripts/gate.mjs` is one dependency-free Node script registered on three hook events.

| Event | What it records |
|---|---|
| `PostToolUse` | A code change (Edit, Write, or a shell command that wrote files), or a successful check |
| `PostToolUseFailure` | A check that failed |
| `Stop` / `SubagentStop` | Nothing; this is where it decides |

A check is a command that exited successfully and is a test runner, linter, type checker, build, a direct run of a script, a request to a local server, or a look at rendered output (a screenshot tool, or reading an image file).

At stop it blocks only when the latest code change is newer than the latest successful check. It lets the turn end when only documentation changed, when it has already asked once for the same change, when the session is waiting on background tasks, and on any internal error.

Claude Code reports success and failure as separate events, so the gate never guesses from output text. Its state is a small JSON file in the OS temp directory holding counters only; no commands, paths or output are stored.

Known limits: a shell command that edits files in a way the gate does not recognise is not counted as a change, and the gate cannot tell whether a check was the right check. The procedures in the skill cover that part.

## Tests

```bash
node --test
```

These cover the gate's decisions with synthetic hook payloads. There is no automated test of model behaviour.

## What changed from upstream 2.1.1

Removed:

- The hooks that ran on every prompt (keyword router, task-mode note). They added text to every turn and defaulted unmatched prompts to "no verification".
- Failure detection by scanning output for words such as "failed", the cause of upstream issues #11, #14 and #19.
- `goals.py`, which accepted self-reported evidence and reported completion with a failed last step. The skill uses the session's task list.
- The measurement scripts, which nothing invoked.
- Onboarding from inside the skill, the transcript scan used to pick a language, and the GitHub star prompt.
- The early-stop text hook, which was documented as shipped but never registered.
- Everything that required `python3` or bash-only paths.

Changed:

- The two procedure packs are now inline in the skill, with report templates and a closing self-check.
- The stop gate checks order (the check must come after the change), no longer depends on a prompt classifier, and accepts only real checks.
- Subagents can set effort; the agent definition does so directly.

## License

MIT, same as upstream. See [LICENSE](LICENSE).
