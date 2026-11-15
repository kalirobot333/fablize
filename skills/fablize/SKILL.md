---
name: fablize
description: Working procedures that make a model finish work properly - investigate to root cause, run or render the result and look at it, and back every "done" with a tool result. Use for debugging or unknown-cause failures, code or plan reviews, building anything that must be run or rendered to be judged (HTML, UI, SVG, charts, games, scripts), and multi-step tasks; or when the user says "fablize", "see it through", "verify as you go", or asks for Fable-level care on another model.
hooks:
  PostToolUse:
    - matcher: "Edit|Write|MultiEdit|NotebookEdit|Bash|PowerShell|Read|mcp__.*"
      hooks:
        - type: command
          command: node "${CLAUDE_PLUGIN_ROOT}/skills/fablize/scripts/gate.mjs"
          timeout: 10
  PostToolUseFailure:
    - matcher: "Bash|PowerShell"
      hooks:
        - type: command
          command: node "${CLAUDE_PLUGIN_ROOT}/skills/fablize/scripts/gate.mjs"
          timeout: 10
  Stop:
    - hooks:
        - type: command
          command: node "${CLAUDE_PLUGIN_ROOT}/skills/fablize/scripts/gate.mjs"
          timeout: 10
---

# fablize

These procedures do not make you more capable. They make sure the work is actually finished and that what you report is what you observed. Start the user's task straight away; there is no setup step.

While this skill is active, a gate checks your turn when you try to end it: if you changed code and no check succeeded afterwards, it sends you back once. Satisfy it by running a real check, not by rewording your report.

## 1. Pick the procedure

Use the smallest one that fits. Use two only when the task really is both.

| The task is... | Follow |
|---|---|
| A bug, a failing test, behaviour nobody can explain | Section 2, Investigate |
| A review of code, a diff or a plan | Section 2, review note |
| Something whose correctness only shows when it runs or renders | Section 3, Run and look |
| Three or more steps that depend on each other | Section 4, Multi-step work |
| Anything else that changes files | Sections 5 and 6 only |

Sections 5 and 6 apply to every task.

## 2. Investigate

1. **Reproduce first.** Run the failing case and read the real output before forming any theory. If you cannot reproduce it, say so and state what you tried.
2. **Write down at least three competing hypotheses** before chasing any of them. The loudest line in the log is one hypothesis, not the answer.
3. **For each hypothesis, name the evidence that would confirm or refute it,** then get that evidence by reading the code path end to end or running a targeted command. Do not rank hypotheses by how familiar they feel.
4. **Trace the whole causal chain.** When you find a cause, ask what allowed it to produce this symptom, and whether removing only the trigger would leave the defect in place.
5. **Prove the cause before changing code.** Then, after the fix, show that the failure itself is gone, using the same reproduction from step 1.
6. **Look for the same defect elsewhere** (same pattern, sibling functions, other callers) and report what you found, fixed or left.

Report in this shape:

```
Root cause: <one or two sentences>
Reproduction: <command> → <what it showed before the fix>
Hypotheses:
  1. <hypothesis> - confirmed by <evidence>
  2. <hypothesis> - rejected by <evidence>
  3. <hypothesis> - rejected by <evidence>
Fix: <what changed, file:line>
After the fix: <same command> → <what it shows now>
Same pattern elsewhere: <found / none found, where you looked>
```

**Review note.** When reviewing, first collect every finding, including the ones you are unsure about. Then check each one against the code and drop or downgrade those that do not hold. Report each surviving finding with file:line, what goes wrong, and a concrete input or situation that triggers it.

## 3. Run and look

For anything that could look wrong or behave wrong in a way that only shows when it runs: a page, a UI, an SVG, a chart, a game, an animation, a script with visible output.

1. **Run it in its real environment.**
   - Web page or UI: open it with the browser tools available in the session (Playwright, the built-in browser, Chrome), or serve it locally and navigate to it. Check desktop width and a real phone width (around 390px, set through device emulation; a plain headless window cannot go below about 500px).
   - SVG or chart: render it to an image.
   - Script or CLI: execute it and capture stdout and stderr.
   - Game or animation: drive it far enough that it actually starts and state changes.
2. **Look at the result.** Open the screenshot and read it. Read the console for errors. Check that the layout is intact, nothing is covered or cut off, text is readable, and interactions respond. A screenshot you saved but did not open is not an observation.
3. **Fix what you saw, then run it again.** One fix, one re-check.

A parser or linter passing means the file is well formed. It does not mean the result is right.

**When to stop:** one clean observation of the current state is enough. Re-run only after you change something. Do not render the same unchanged thing again to feel more sure.

Skip this section for prose, configuration, and logic that already has tests; for those, run the tests.

## 4. Multi-step work

1. Write the steps into the session's task list before starting. Each step states something you can check, not just an activity.
2. Make the last step a check of the whole result, separate from the per-step checks.
3. Work one step at a time. Mark a step done only after a tool result shows it is done.
4. If a step is blocked, say what blocks it and continue with steps that do not depend on it. Do not mark it done and do not silently drop it.

## 5. Report contract

Lead with the outcome. Stay inside what was asked: no extra refactors, no new abstractions. Ask before anything destructive or hard to undo.

End every report that follows changed files or an investigation with these two lines:

```
Verified: <command you ran or thing you looked at> → <what you observed>
Not verified: <what you could not check, and why>   (or "nothing")
```

"Verified" may only name checks that ran in this session, after the last change, and that you read the output of. A check that ran before your final edit does not count. If a check failed, report the failure; do not describe it as passing or omit it.

## 6. Before you finish

Go through your draft report claim by claim:

- For each statement that something works, is fixed, passes or renders correctly, point to the tool result in this session that shows it.
- No tool result: either run the check now, or move the statement under "Not verified".
- Anything you said you would do in this turn: either it is done, or the report says it is not.

## 7. When you are stuck

Stuck means the same approach has failed twice. Do not try it a third time.

1. Write down what you know: symptoms, what you tried, where it fails, the reproduction, and the one specific question that is blocking you.
2. Hand that question, with those notes, to a fresh agent: the `fablize` agent, or an Agent call with a higher `effort` if the session allows. Ask for a structured answer. A fresh context often sees what a long one has stopped seeing.
3. If that does not resolve it, tell the user plainly what is blocking, what you ruled out, and what a person needs to decide or provide. Raising the session's effort level is the user's choice; you can suggest it.
