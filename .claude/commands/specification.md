---
description: Author the technical SPEC and the QA test plan for an accepted GitHub issue — invokes the specifier agent (codegraph inspection, the Public API and SemVer calls, the SDK-types check, architecture/security consults) and writes both to .project/tasks/issue-<N>/. Local files only; the GitHub issue is never modified. Idempotent on re-run.
argument-hint: <#N>
allowed-tools: mcp__github__issue_read, mcp__github__search_issues, mcp__codegraph__codegraph_search, mcp__codegraph__codegraph_explore, mcp__codegraph__codegraph_impact, Read, Write, Edit, Grep, Glob, Task
---

<Coordinator name="specification" stage="Accepted issue → spec.md + test-plan.md in the task workspace">
You coordinate the stage that makes an accepted issue buildable: turning a requirement (current →
target → why) into the structured technical analysis the work will be built against, plus the QA
plan that will verify it.

**WHERE THE SPECIFICATION GOES — this is the whole point of the stage, so it is stated first:**

| Artifact | Written to | Contains |
| --- | --- | --- |
| `spec.md` | `.project/tasks/issue-<N>/` | The technical analysis — the source of truth |
| `test-plan.md` | `.project/tasks/issue-<N>/` | The QA / acceptance plan `/develop` will execute |

**The GitHub issue is READ, never written.** No pointer, no summary, no comment, no label change —
nothing. The issue is the requirement as its author wrote it; the specification is your local
analysis of how to satisfy it. Two artifacts, two owners, no synchronisation between them and
therefore no way for them to disagree.

You have **no GitHub write tool** in `allowed-tools`, deliberately. If you find yourself wanting to
put the SPEC — or a summary of it, or a link to it — into the issue, that is the design saying no.

The **`specifier`** agent is the executor — it inspects the code, resolves real names, decides the
Public API and SemVer impact, and records the architecture/security findings. You invoke it; you
never replicate its work inline.

**There is no subtask stage.** One repository, one published package — Caperifai's work-breakdown
stage has no equivalent here. One issue is one unit of work.
</Coordinator>

<Input>
`$ARGUMENTS` — the accepted issue's number. The workspace layout, the SPEC section structure, and
the QA plan's scope are stable facts (the `task-workspace` and `spec-driven` skills) — not
parameters.
</Input>

<Musts reason="identify the minimum needed to not guess critical parts, then continue and propose">
The must here is that **the issue's requirement is clear enough to spec**: its current → target →
why, and which surfaces it touches. Once met, continue.

For anything unclear — an acceptance criterion that doesn't say what success looks like, a
capability whose exported shape was never decided, a bug with no root cause yet — **ask**. Never
invent the scope, the diagnosis, an acceptance criterion, or a dependency.

**A bug issue with no root cause is not ready to spec.** Point at `/debug <#N>` first: a SPEC built
on a guessed cause specifies the wrong fix, and does it in a form that looks authoritative.

**"Not ready to spec" is a valid, useful outcome.** If the requirement admits several materially
different designs and the choice was never made, the SPEC says so and names the specific question
that must be answered — it does not invent a design that reads as decided. That outcome still gets
written: the analysis is worth keeping, and the named question is the deliverable.
</Musts>

<Process>

1. **Read the issue AND its comments** (`issue_read`, `method: "get"` then `"get_comments"`) — its
   requirement and its full acceptance criteria. In this repository the load-bearing constraints
   frequently live in comments, not the body. Read only; you are not going to write back.

2. **Check the workspace for prior work** — `.project/tasks/issue-<N>/`. This is a re-entry check,
   and getting it wrong discards decisions the user already made:
   - **`spec.md` exists** → report what it says and ask whether to **refine** it (the `spec-driven`
     skill's Refine action) or leave it. Never blind-overwrite: `.project/` is gitignored, so there
     is no diff and no history to recover a dropped section from.
   - **`notes.md` exists** → read it. It holds what was already tried and ruled out; re-proposing a
     rejected approach is the specific waste it exists to prevent.
   - **`verification.md` exists** → development already ran against the current SPEC. Say so before
     changing anything underneath it: a refine that moves the approach invalidates evidence already
     gathered, and the user needs to know which criteria would have to be re-proven.

3. **The `specifier` agent authors both artifacts.** Invoke it via Task, asking for `spec.md` **and**
   `test-plan.md`. It inspects the actual code (`codegraph_*` / `Read`), resolves real symbol names,
   decides `Public API impact` and `SemVer impact` explicitly, discharges the SDK-types check for
   every type the work needs, and records the architecture and security axis findings — including any
   axis it decides **not** to fire, with the reason. It authors the QA plan too, because the
   regression surface comes from `codegraph_impact` on the symbols it just traced; splitting that
   between two actors means tracing the same graph twice. The deep analysis is the specifier's; a
   coordinator never does it inline.

4. **The Security axis, at this stage, is a DESIGN review — not a diff review.** Per the
   `github-issues` skill's `<SecurityAxisByStage>`: **do not invoke `/security-review` here.** That
   skill reviews the pending diff on the branch, and at SPEC time there is no diff — it would report
   findings about whatever unrelated work happens to be uncommitted. The consult at this stage is the
   specifier's design-level analysis in the SPEC's `Consults` row: what the proposed shape exposes,
   whether it is being positioned as an authorization mechanism, what session-lifetime consequences
   it carries. **Record in the SPEC that the diff review is owed at `/develop`.** Skipping the tool
   is correct; skipping the thinking is not.

5. **Check `spec.md`** against the `spec-driven` skill's section structure and evidence discipline
   (`templates/SPEC.md`) before accepting it. It is the TECH layer: it **references, never restates**
   the issue's request layer, a bug's reproduction and RCA, `CLAUDE.md`, or `.handbook/`. Do not let
   it copy the issue's acceptance criteria — they would drift, and the issue's are the ones that
   count.

   Two sections are non-optional judgment calls this project cannot ship without:
   - **`Public API impact`** — what changes in the surface exported from `src/index.ts`. `_n/a_`
     only when the emitted `.d.ts` would be byte-identical, and that is a claim to prove.
   - **`SemVer impact`** — the bump and the Conventional Commits type that produces it, with
     reasoning. `/develop` reads this to write the commit message. A removed, renamed, or narrowed
     export is MAJOR (`feat!`) however small it feels.

   Spot-check the load-bearing `file:line` citations yourself. The specifier has no Bash tool and
   cannot run a command to confirm anything — a claim it marked `[Verified]` from codegraph is worth
   one `grep` when the whole design rests on it.

6. **Check `test-plan.md`** against the `task-workspace` skill's `<TestPlanScope>`. It must be **QA /
   acceptance level, not the unit specs**: protocol-level behaviour through the Inspector, the
   protocol-era matrix (`2026-07-28` modern vs the 2025 legacy fallback, over the one HTTP transport), the affected
   `examples/`, the compatibility surface, the regression surface from `codegraph_impact`, and the
   upgrade path when the SPEC called this `feat!`.

   Every case must name the **command** that runs it and what **pass** means. A case nobody can
   execute from the text will not be executed. **If every case reduces to `pnpm test`, send it back**
   — that is a coverage report, not a QA plan.

7. **Write the two files** to `.project/tasks/issue-<N>/`, creating the directory now (lazily — only
   once there is something real to write). They are **local, gitignored, and reviewable in the
   editor**, which is the only practical way to read a multi-hundred-line artifact — so report the
   paths and the headline decisions (`Public API impact`, `SemVer impact`, any blocking open
   question), not the full text. Dumping several hundred lines into the conversation is not a review.

   On a re-run, **`Read` the existing file first** and refine rather than overwrite. `.project/` is
   gitignored: no diff, no history, nothing to recover a dropped section from.

8. **Report** the paths, the headline decisions, and anything the SPEC flagged as blocking or
   `[Unverified]`. If the outcome was "not ready to spec", lead with the question that must be
   answered — that is the actionable part.

   **If a decision in the SPEC is something a contributor or consumer genuinely needs to know** — the
   change is breaking, the issue is blocked on an unanswered design question, a stated requirement
   turns out to be unbuildable — say so in your report and **suggest the user comment on the issue
   themselves**. You do not post it: the workspace is deliberately private, and what leaves it is the
   maintainer's call, not an automatic side effect.
</Process>

<Handoff>
Next stage: `/develop <#N>` — reads `spec.md` and `test-plan.md` from the workspace, produces the
concrete execution plan in its own conversation (that plan is ephemeral and never written to disk),
then executes with the five-phase quality gate, runs the QA cases, and records the result in
`verification.md`. This command stops at the analysis; it never writes code and never touches GitHub.
</Handoff>

<References>
  <Ref skill="task-workspace" reason="The workspace layout, which stage owns which file, the re-entry checks, and the QA-vs-unit boundary that defines test-plan.md's scope." />
  <Ref skill="spec-driven" reason="The SPEC section structure, the evidence discipline (file:line from calls run this session, Current state before Proposed approach, inline confidence tags), and the SemVer decision table." />
  <Ref skill="github-issues" reason="The consult axes and the stage-dependent Security consult; the reason this command has no GitHub write tool." />
  <Ref doc="CLAUDE.md" reason="SDK-types-first, the core patterns the SPEC must not contradict, and the honesty bar on unverified claims." />
</References>
