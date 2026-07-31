---
description: Plan AND execute an issue's local development against its SPEC — reads .project/tasks/issue-<N>/spec.md and test-plan.md, produces the concrete execution plan in-session (stops for your approval), runs it through the developer agent with the five-phase quality gate and the pre-commit consults, executes the QA test plan, and records every acceptance criterion in verification.md. Never runs git; suggests the branch name and commit message.
argument-hint: <#N>
allowed-tools: mcp__github__issue_read, mcp__github__search_issues, mcp__codegraph__codegraph_search, mcp__codegraph__codegraph_explore, mcp__codegraph__codegraph_callers, mcp__codegraph__codegraph_impact, Read, Write, Edit, Grep, Glob, Bash, Task, Skill
---

<Coordinator name="develop" stage="Issue + SPEC → execution plan → local execution → verification record">
You coordinate the PLAN and the LOCAL EXECUTION of an issue's development. **You do NOT write code
yourself** — you delegate to the **`developer`** agent and run the consults. You resolve what to build
and in what order, produce the plan, **stop for the user to validate it**, and on approval execute
it.

Scope is **local development only** — no merge, no release, no publish.

`/specification` already decided **what** must be built and **how it will be verified**:
`.project/tasks/issue-<N>/spec.md` and `test-plan.md`. `/develop` decides **how, concretely, against
this working tree** and then does it. It executes against the SPEC; it does not re-derive the
technical analysis and it **never edits `spec.md`** — a wrong SPEC is a `/specification` refine, not
something to bend the work around.

**The execution plan is ephemeral.** It lives in this conversation and is not written to disk. It is
specific to the working tree in front of you and stale the moment the code moves; a stale plan on
disk is worse than none, because a later session reads it as current. What persists from this
command is the **evidence**: `verification.md` and `notes.md`.

**This command also performs the verification** that Caperifai splits into a separate `/test` stage:
the QA plan is executed and the issue's full acceptance criteria are recorded before anything is
declared ready to commit.
</Coordinator>

<Input>
`$ARGUMENTS` — the issue number. The workspace layout, the label taxonomy, and the branch-naming
convention live in the `task-workspace` and `github-issues` skills and
`.handbook/GIT_GUIDELINES.md`.
</Input>

<Musts reason="universal to every command">
**MUSTS** = the minimum to not guess critical parts. Here: the issue, its acceptance criteria, and
its SPEC. Once met, **continue and build the plan**.

For anything unclear — an acceptance criterion whose success signal is undefined, a SPEC claim the
current code contradicts — **emit questions** or verify against the code. **Never invent** a file, a
dependency, or a plan detail to fill a gap.

**Scope discipline (hard).** The plan and the execution cover EXACTLY the issue's scope — what it
implies, nothing more. `developer` does not extend into another issue's work, however incomplete the
whole looks without it. If something **critical to this issue's own delivery** is missing, it is
**surfaced as a blocker** and appended to `notes.md` — never silently built. Getting creative and
implementing the neighbouring piece is the failure this guards against.
</Musts>

<Process>

## Phase 1 — Plan (in-session; stops for your approval)

1. **Check preconditions.** `issue_read` the issue and its comments.
   - **No `spec.md` in `.project/tasks/issue-<N>/`** → **stop** and point at `/specification <#N>`.
     The technical analysis belongs there. Prepare nothing. Note that the issue itself will show no
     sign of whether a SPEC exists — nothing is ever written to it — so the workspace is the only
     place to check, and an absent `spec.md` means either the SPEC was never written or the workspace
     lives on another machine. Either way, do not improvise the analysis here.
   - **`Blocked by #N` unresolved** → stop and report.
   - **Bug issue with no root cause** → stop and point at `/debug <#N>`.
   - **The SPEC declares itself not ready** → **stop.** Read the `**Status:**` field, which
     `templates/SPEC.md` requires on the third line:

     ```
     grep -m1 '^\*\*Status:\*\*' .project/tasks/issue-<N>/spec.md
     ```

     `ready` → continue. `blocked: <question>` → **stop and report the question.** Missing → treat as
     `blocked` and say the SPEC predates the field, rather than assuming either way.

     A SPEC is allowed — and expected — to conclude that a requirement admits several materially
     different designs and that the choice was never made. When it says so, the missing piece is a
     **decision**, not code. Building anyway means inventing the design the SPEC deliberately refused
     to invent, and doing it inside an execution plan, where it reads as settled.

     This check exists because the other three preconditions all pass in exactly that case: `spec.md`
     present, nothing `Blocked by`, not a bug. Without it the command sails into planning a design
     nobody chose — verified on issue #30 before its Open decision was resolved.

     **Why a field and not a grep over the prose:** the first version of this gate grepped for
     `NOT READY|BLOCKING|Open decision|UNDECIDED`, and on the *unblocked* #30 SPEC it matched nine
     times — every hit in the refine log describing the block's removal, in "No **blocking**
     dependency", or in the historical `Notes`. Those words appear naturally in prose that means the
     opposite. A gate that cries wolf is worse than no gate, because it trains you to skip it.

   - **The SPEC contradicts itself** → **stop and point at `/specification <#N>` for a refine.** If
     two sections make opposing claims about the same fact, there is no baseline to execute against
     and picking one is guessing. This is a real failure mode of an earlier refine, not a
     hypothetical.

     **This one cannot be greped** — a refine log legitimately quotes the wrong claim it corrected, so
     any pattern matching the old wording hits the record of its own fix. Judge it while reading the
     SPEC in step 2: when two sections assert opposite things about the same fact and neither is
     marked as a superseded quote, stop.

2. **Read the workspace** — `spec.md`, `test-plan.md`, and `notes.md` in full, plus `verification.md`
   if a previous run left one.
   - The SPEC's decisions are inputs, not suggestions: its `Public API impact`, `SemVer impact`,
     `Type contracts`, and `Closure condition` bind this execution.
   - `notes.md` holds what was already tried and ruled out. Re-proposing a rejected approach is the
     specific waste it exists to prevent.
   - An existing `verification.md` records what was already proven; a criterion proven with evidence
     does not need re-proving unless the code it rests on moved.

3. **Verify the current code state** for what is about to change — with `codegraph_*` and `Read`, in
   this session. A SPEC authored earlier may describe code that has since moved. Planning on top of
   an unverified claim is how a plan becomes fiction. If the code contradicts the SPEC, **stop and
   report it** — that is a `/specification` refine, not something to absorb into the plan.

4. **Produce the plan** per `<PlanStructure>` below. There is no wave or concurrency model: that was
   a multi-subrepo concern and this repository has one package. Sequencing here is **real dependency
   only** — the exported symbol changes before the examples that consume it; the regression test is
   written before the fix it must fail against. Do not invent phases to look organised.

5. **Report the plan and STOP for the user to validate it.** Do not start executing until approved.
   The plan stays in the conversation — do not write it to the workspace.

## Phase 2 — Execute (only after the plan is approved)

6. **Delegate to `developer`** via Task, with the SPEC's decisions and the plan's steps. It applies the
   core patterns from `CLAUDE.md`, reuses SDK types, and implements exactly the given scope.

   **Pass the plan's first-test decision per step**, and require the `test-first` skill's
   observed-red evidence back: the command run and the **failure message read**, not a claim that the
   test was written first. "Written first" is unverifiable in a finished diff; "observed failing for
   the predicted reason" is the checkable form and the only one worth recording.

7. **The five-phase quality gate**, run to completion by `developer`, fixing everything each phase
   surfaces **before advancing**. Skipping a phase is silent breakage.

   ```
   pnpm quality:fix → pnpm typecheck → pnpm knip → pnpm test → pnpm test:e2e
   ```

8. **Consults — they evaluate the diff and return FEEDBACK; they do not create issues.** Per the
   `github-issues` skill's `<ConsultAxes>`:
   - **`code-reviewer` — ALWAYS**, on every diff. No exceptions, no "it's a one-liner".
   - **`/security-review` skill — by the Security axis**: guards, session handling, transport-level
     input parsing, env or filesystem access, dependency changes. Record a non-consult with its
     reason when it does not fire.
   - **Public-API axis — when the SPEC's `Public API impact` is not `_n/a_`**: the affected examples
     must still run, per `CLAUDE.md`. A green typecheck is not a substitute: *"Compiling is not
     executing."*

9. **Loop until green.** `developer` addresses the feedback **now** and re-runs the gate; nothing is
   left with feedback open. A finding it **cannot resolve in scope** — genuinely out-of-scope debt,
   or a separate bug surfaced during the work — is **surfaced to the user as a proposed Mode X or
   Mode B issue** (per `github-issues`) and appended to `notes.md`. Never silently dropped, and never
   a `// TODO` against a non-existent issue number.

10. **Execute the QA test plan** — the cases in `test-plan.md`: the Inspector session, the transport
    matrix, the affected examples, the compatibility checks, the regression smoke tests, and the
    upgrade path when the SPEC called this `feat!`. These are what a unit suite structurally cannot
    catch; running the specs is not a substitute for running them.

11. **Record `verification.md`** — per `task-workspace`'s `templates/verification.md`, written **as
    the evidence arrives**, not reconstructed at the end from memory. Map **every** acceptance
    criterion on the issue to pass/fail **with the evidence that proves it**: the spec, the command
    output, the observed session. A criterion with no evidence is `[Unverified]` and the work is not
    done. If any criterion fails, report it and stop — do not declare ready-to-commit.

12. **Ready-to-commit.** When the gate is green, the consults are clear, the QA cases pass, and every
    acceptance criterion is verified with evidence, report:
    - the **branch name** per `.handbook/GIT_GUIDELINES.md`: `feature/issue-<N>-<short-desc>` or
      `bugfix/issue-<N>-<short-desc>`;
    - the **Conventional Commits message**, whose type comes from the SPEC's `SemVer impact` — not
      re-decided here — with `Closes #<N>` in the footer, and the verbatim `BREAKING CHANGE:` footer
      when the SPEC called it MAJOR.

    **You never run git.** A `CLAUDE.md` non-negotiable and a blocked hook: the user commits.
</Process>

<PlanStructure reason="fixed shape so the plan is not improvised — fill these sections, in this order, and no others">
The Phase-1 plan is presented in the conversation. It is concrete and file-level: this is the
command that names real files, and the specificity is the point.

1. **Context** — two or three lines: what this issue delivers and the current code state (greenfield
   vs building on existing). No restating the issue.
2. **SPEC anchors** — `Public API impact`, `SemVer impact`, and `Closure condition`, quoted from
   `spec.md` rather than re-derived. Quoting them is what stops the implementation from quietly
   disagreeing with the spec halfway through.
3. **Steps** — the ordered work, each naming the **real files** to touch, resolved via `codegraph_*`
   in this session. Include the documentation and example updates that accompany the change; they
   are part of the work, not a follow-up. Sequencing only where a real dependency exists. Never a
   step whose outcome is "code written".

   **Every step names its first test**, per the `test-first` skill's `<Protocol>` table: the spec
   that gets written and observed failing before any implementation. Where the row says test-first
   does not apply — a chore, a refactor (which inverts), a docs change — **name the row and its
   substitute verification** instead. A step with neither a first test nor a cited row is an
   omission, not a decision, and it is the plan's job to make that visible before work starts.
4. **Consults that will fire** — code-review (always), security (with the axis trigger or the reason
   it does not fire), public-API (with the examples to run, or `_n/a_`).
5. **Verification** — the `test-first` row each step lands in, which of `test-plan.md`'s QA cases this work makes runnable, the unit and e2e
   specs that will exist when it is done (for a bug fix, the one that must **fail without the fix**),
   and the five-phase gate.
6. **Suggested commit** — the Conventional Commits message from the SPEC's `SemVer impact`, with
   `Closes #<N>`. Stated before the work starts so the SemVer call is visible rather than improvised
   at commit time.
</PlanStructure>

<WorkspaceDiscipline reason="the workspace is only worth having if it stays true">
| File | This command's relationship to it |
| --- | --- |
| `spec.md` | **Read-only.** A wrong SPEC is a `/specification` refine. |
| `test-plan.md` | **Read and execute.** Results go to `verification.md`, not back into this file. |
| `verification.md` | **Owned.** Written as evidence arrives. |
| `notes.md` | **Append-only.** Dead ends, out-of-scope findings, surprising SDK behaviour. |
| the execution plan | **Not a file.** It lives in this conversation. |

`.project/` is gitignored — nothing here is visible to a contributor or to CI. Anything load-bearing
that someone else must eventually know goes in the **issue**, not only here.
</WorkspaceDiscipline>

<Handoff>
After the user commits and opens a PR to `main`, the release is a separate, manual step: GitHub
Actions → Release → Run workflow (`.handbook/GIT_GUIDELINES.md`). **Closing an issue is not
publishing to npm** — if a consumer is waiting on the version, say so explicitly.

The workspace stays on disk after the issue closes. It costs nothing, it is not versioned, and it is
the only record of why an approach was rejected.
</Handoff>

<References>
  <Ref skill="test-first" reason="Which kind of work starts with a failing test, which starts from a green suite instead (refactors invert), which is verified another way (chore/CI/docs), and the observed-red discipline the plan and the verification record both depend on." />
  <Ref skill="task-workspace" reason="The workspace layout, which file this command owns, why the execution plan is deliberately not one of them, and the QA-vs-unit boundary that defines test-plan.md's cases." />
  <Ref skill="spec-driven" reason="The SPEC this command executes against — particularly SemVer impact, which decides the suggested commit type, and Closure condition." />
  <Ref skill="github-issues" reason="The consult axes, the shape of any debt/bug issue surfaced mid-work, the branch-naming convention, and the authorization contract for anything proposed." />
  <Ref doc="CLAUDE.md" reason="The five-phase quality gate, the core patterns, the coverage targets, the examples check when the public API changed, and the no-autonomous-git non-negotiable." />
  <Ref doc=".handbook/GIT_GUIDELINES.md" reason="Branch naming from the issue number, Conventional Commits format, and the manual release dispatch." />
</References>
