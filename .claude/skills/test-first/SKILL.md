---
name: test-first
description: "The test-first protocol for @nestjs-mcp/server: which kinds of work must start with a failing test, which must start from a green suite instead, and which are verified some other way entirely. Includes the observed-red discipline and how the outcome is recorded. Load before implementing any change, and when deciding what the first test for a piece of work should be."
---

<Purpose>
Decide **what gets written first**, per kind of work, with a reason — instead of applying "write a
test first" as a slogan or skipping it as an inconvenience.

Test-first is not a virtue signal here; it buys one specific thing that is otherwise unobtainable:
**proof that a test constrains the code.** A test written after the code it tests passes by
construction. You cannot tell, later, whether it would have caught anything. Writing it first and
watching it fail is the only cheap way to know.

But that argument does not apply to every change, and pretending it does produces theatre — a
nominal test written to satisfy a rule, then reshaped to match whatever got built. That is worse
than honest test-after, because it looks like evidence. So this skill says where the discipline
bites, where it inverts, and where it does not apply at all — and requires you to **state which
case you are in** rather than silently choosing.
</Purpose>

<WhenToUse>
  <Trigger>About to implement any change to this library — before writing the first line.</Trigger>
  <Trigger>Deciding what the first test for a piece of work should be, or whether there is one.</Trigger>
  <Trigger>Planning a slice in `/develop` — the plan names the first test per step.</Trigger>
  <Trigger>Fixing a bug, after the cause is identified (`bug-diagnosis` Phase 3 → 4).</Trigger>
  <Trigger>Recording verification evidence — what was observed red, and when.</Trigger>
</WhenToUse>

<Protocol name="Which work starts with what">
Find the row. If two rows apply, the **stricter** one wins (MANDATORY beats DEFAULT beats NO).

| Kind of work | First thing written | Obligation | Why this and not something else |
| --- | --- | --- | --- |
| **Bug fix** (Mode B) | a spec that reproduces the defect | **MANDATORY** | The only way to prove the test fails *without* the fix. Written after, you would have to revert the fix to check — nobody does, which is exactly how a test that passes either way ships. |
| **New capability on the public surface** (Mode C) | the **consumer's call site**: a spec that imports from `src/index.ts` and uses the API exactly as a consumer would | **MANDATORY** | For a published library the call site *is* the design. Writing it first is when an awkward signature is cheap to fix; after publication it is a breaking change. This is the highest-value row in the table and the one most often skipped. |
| **Change to an existing exported signature** | two specs: one at the **old** shape (must now fail) and one at the new | **MANDATORY** | It proves the `SemVer impact` call empirically. If the old-shape spec still passes, the change was not breaking and the SPEC said MAJOR wrongly — and vice versa. |
| **Internal logic** — decorator metadata, registry behaviour, guard resolution, pure functions | a unit spec on the behaviour | **DEFAULT yes** | Cheap, fast, and it is where a spec most easily passes by construction if written afterwards. Check the current coverage of the method you are about to touch — `pnpm test:cov`, or `codegraph` on the symbol — rather than trusting the global percentage, which hides per-method gaps. Departing from the default needs a stated reason. |
| **Transport / protocol behaviour** | an e2e spec, reusing the harness in `test/` | **yes when a harness exists** | `test/` already carries `base`, `concurrent-clients`, `protocol-eras`, `stateless-load-balancing`, `mcp-features` and `examples-smoke` — check which one already sets up what you need before building a harness. If building the harness **is** the work, the harness is the deliverable: say so and write it first instead. |
| **Refactor** (Mode R) — no behaviour change | **nothing new.** Run the existing suite green *before* touching anything | **INVERTED** | See `<TheRefactorInversion>`. Test-first is the wrong instrument here and applying it hides the actual check. |
| **Performance** | a **measurement** of the current number, not a spec | **MANDATORY, as a benchmark** | Without a before-number, "faster" is unfalsifiable. A passing test says nothing about speed. |
| **Docs / examples** (Mode D) | nothing | **NO** | The verification is that the example runs: `EXAMPLE=<name> pnpm start:example`. |
| **Chore / deps / toolchain / CI** (Mode T) | nothing | **NO** | The gate *is* the test. `pnpm typecheck` passing on a new TypeScript major, `pnpm audit` clean, the workflow green on the new runner. Writing a spec first here is pure theatre — there is no behaviour to constrain. |
| **Accepted debt** (Mode X) | nothing now | **NO** | Its closure condition is the verifiable trigger, checked when the debt closes. |

**Whatever the row, state it.** In the `/develop` plan, each step names its first test — or names
this table's row and why that row applies. "No test for this step" with no row cited is not a
decision, it is an omission.
</Protocol>

<ObservedRed reason="the difference between the discipline and its imitation">
"Test written first" is not the checkable claim. **"Test observed failing, for the expected
reason, before the implementation existed"** is.

Three ways the discipline is faked, all of which look identical in a finished diff:

| Failure mode | What it looks like | Why it is worthless |
| --- | --- | --- |
| Written first, never run | a spec committed alongside the fix | You do not know it ever failed. It may assert something already true. |
| Failed for the wrong reason | red, but from a typo, a missing import, a bad mock | It proved the harness was broken, not that the behaviour was absent. **Read the failure message.** |
| Written after, claimed retroactively | "this would have failed before" | Unverifiable, and usually false — a test written against existing code is shaped by it. |

So the sequence is: **write it → run it → read the failure → confirm it is the failure you predicted
→ then implement.** The middle two steps are the whole protocol; skipping them leaves the ritual
without the benefit.

When the expected failure does not appear, that is information, not an obstacle: either the
behaviour already exists (so the issue may be stale — check before building), or the test does not
exercise what you think it does. Both are worth knowing before writing code.
</ObservedRed>

<TheRefactorInversion reason="the row most likely to be got backwards by applying TDD reflexively">
A refactor is defined by behaviour **not** changing — `.github/ISSUE_TEMPLATE/refactoring.yml` makes
it the reporter's own prerequisite: *"this refactoring doesn't change public API or break existing
functionality."*

So the discipline inverts. Instead of a new failing test:

1. Run the existing suite **before** touching anything. It must be green. A refactor started on a
   red suite cannot be verified, because you will not know which failures you caused.
2. Refactor.
3. The **same** suite must pass, **unedited**.

**If you had to change a test to make it pass, you changed behaviour, and this is not a refactor.**
Stop and re-classify: a widened surface is Mode C (`feat`), a narrowed one is Mode C breaking
(`feat!`). That check is the entire value of the row, and writing a new test first would obscure it
by giving you something new to point at.

Adding *missing* coverage to code you are about to refactor is fine and often wise — but that is its
own step, done and green **before** the refactor starts, not part of it.
</TheRefactorInversion>

<Recording reason="the protocol is only real if the outcome is written down">
`verification.md` (the `task-workspace` skill's template) already carries the field this protocol
needs:

```
- Test: `<path>`
- Confirmed failing without the fix: yes / no — <how that was confirmed>
```

Fill it with **how**, not just yes: the command run, and the failure message observed. `yes` alone is
the retroactive claim from `<ObservedRed>` wearing a checkbox.

For rows where test-first does not apply, record the row and its substitute verification instead —
"Mode T: no first test; `pnpm typecheck` green on TypeScript 6 is the gate" is a complete and honest
entry. A blank is not.
</Recording>

<Conventions>

- **Diagnosis precedes the test.** For a bug, the cause must be identified first (`bug-diagnosis`
  Phases 1–3). A test written before the cause is known tests a guess. The order is
  **diagnose → failing test → fix**, and the middle step is not optional.
- **Co-located unit specs** in `src/` (`*.spec.ts`); e2e specs in `test/` (`*.e2e-spec.ts`).
- **Coverage thresholds** (`package.json` → `jest.coverageThreshold`: 80% statements, 55% branches,
  70% functions, 85% lines) are a floor, not a target, and are not evidence that a test constrains
  anything.
- **Never mock the SDK to assert your own assumption about it.** If the claim is about
  `@modelcontextprotocol/sdk` behaviour, exercise the real SDK. A mock that encodes your belief
  proves only that you are consistent.
- **A test is not a substitute for the QA plan.** `test-plan.md` covers what a real MCP client
  observes; unit and e2e specs are the floor it stands on.

</Conventions>

<Pitfalls>
  <Pitfall>Writing the test first and never running it. The failure you did not observe is the evidence you do not have.</Pitfall>
  <Pitfall>Accepting any red as proof. A typo, a missing import, or a broken mock is red for the wrong reason — read the message.</Pitfall>
  <Pitfall>Claiming a test "would have failed" before the fix. Unverifiable, and usually false.</Pitfall>
  <Pitfall>Applying test-first to a refactor. It inverts: the existing suite runs green first and must pass unedited afterwards.</Pitfall>
  <Pitfall>Editing a test to make a refactor pass — that is a behaviour change wearing a refactor's label. Re-classify it.</Pitfall>
  <Pitfall>Writing a nominal spec for a dependency bump or a CI change to satisfy the rule. The gate is the test; say so.</Pitfall>
  <Pitfall>Shipping a new public API without having written its consumer call site first. The call site is the design, and after publication an awkward signature is a breaking change to fix.</Pitfall>
  <Pitfall>"Faster" with no before-number.</Pitfall>
  <Pitfall>Writing the test before the bug's cause is identified — it tests a guess.</Pitfall>
  <Pitfall>Leaving the row unstated. "No test for this step" without citing which row applies is an omission, not a decision.</Pitfall>
</Pitfalls>

<References>
  <Ref skill="bug-diagnosis" reason="Phases 1–3 establish the cause that a bug's first test is written against; this skill owns the ordering from there." />
  <Ref skill="task-workspace" reason="verification.md is where the observed-red evidence is recorded, and test-plan.md is the QA layer above these specs." />
  <Ref skill="spec-driven" reason="The SPEC's Public API impact and SemVer impact decide which MANDATORY row a change lands in." />
  <Ref doc="CLAUDE.md" reason="The five-phase quality gate, the coverage thresholds, and the rule that compiling is not executing." />
  <Ref doc="test/base.e2e-spec.ts" reason="The existing e2e harness to reuse rather than build, for the transport/session row." />
</References>
