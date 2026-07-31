<!--
## Verification record — .project/tasks/issue-<N>/verification.md

Written by /develop in Phase 2, as the evidence arrives. This is the file that replaces Caperifai's
separate /test stage: every acceptance criterion on the issue mapped to pass/fail WITH the evidence
that proves it.

THE RULE THIS FILE EXISTS TO ENFORCE: a criterion with no evidence is [Unverified], and the work is
not done. "It compiles" is not evidence — CLAUDE.md: types verify code, not behavior.

Write it as results arrive, not at the end from memory. A row filled in from recollection is a
claim, not a record.

Delete this comment block when writing the real file.
-->

# Verification — #<N> <issue title>

**SPEC:** `.project/tasks/issue-<N>/spec.md` · **QA plan:** `.project/tasks/issue-<N>/test-plan.md`
**Run:** <YYYY-MM-DD> · **Commit under test:** <short sha or `working tree`>

## Acceptance criteria

Every criterion from the **issue**, verbatim — not paraphrased, not reordered, none omitted. If a
criterion cannot be verified, it is `FAIL` or `[Unverified]`, never quietly dropped.

| # | Criterion (verbatim from the issue) | Result | Evidence |
| --- | --- | --- | --- |
| 1 | <criterion> | PASS / FAIL / [Unverified] | <the spec that proves it, the command output, the observed session — something a reader can re-run> |
| 2 | | | |

## Quality gate

Every phase, with its real outcome. A phase that was not run is `not run`, never blank.

| Phase | Command | Result |
| --- | --- | --- |
| 1 | `pnpm quality:fix` | |
| 2 | `pnpm typecheck` | |
| 3 | `pnpm knip` | |
| 4 | `pnpm test` | |
| 5 | `pnpm test:e2e` | |

**Coverage** (thresholds: 80% statements / 55% branches / 70% functions / 85% lines):

| Metric | Threshold | Actual |
| --- | --- | --- |
| Statements | 80% | |
| Branches | 55% | |
| Functions | 70% | |
| Lines | 85% | |

## Test-first record

One row per step of the work. The `test-first` skill's `<Protocol>` table decides which row each
step lands in; this is where the outcome is proven.

**`yes` on its own is not an answer.** Record the command run and the **failure message observed** —
"written first" is unverifiable after the fact, "observed failing for the predicted reason" is not.
Where the row says test-first does not apply (chore, docs, or a refactor, which inverts), name the
row and its substitute verification; a blank is not an entry.

| Step | `test-first` row | First test | Observed red? | Evidence |
| --- | --- | --- | --- | --- |
| <step> | bug fix / public capability / changed signature / internal logic / transport / refactor (inverted) / chore (n/a) | `<path>` or `_n/a_` | yes / no / n/a | <the command, and the failure message read — or, for a refactor, that the existing suite ran green before and passed unedited after> |

For a refactor, the check is that **no test was edited**. If one was, the change was not a refactor —
record that here rather than letting it pass.

## QA cases

Results from `test-plan.md`, by case id.

| Case | Result | Evidence |
| --- | --- | --- |
| P1 | | |
| T1 | | |
| C1 | | |
| R1 | | |

## Consults

| Axis | Fired | Outcome |
| --- | --- | --- |
| Quality (`code-reviewer`) | yes | <verdict, and whether the blocking list cleared> |
| Security (`/security-review`) | yes/no | <finding, or the reason the axis did not fire> |
| Public API (examples run) | yes/no | <which examples ran, or why `_n/a_`> |

## Unresolved

Anything found and **not** fixed in this scope — an out-of-scope defect, accepted debt, a
criterion that could not be verified. Each with what was proposed for it (a Mode B or Mode X issue).
Empty is a valid and meaningful answer; silence is not.

## Verdict

**Ready to commit** / **Blocked** — and if blocked, exactly what must clear first.
