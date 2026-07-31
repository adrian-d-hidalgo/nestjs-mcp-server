---
description: Coordinate a root-cause analysis for any bug signal — a raw symptom, an existing GitHub issue, a stack trace, or a failing test. Detects the input type deterministically, applies that route's protocol (report sufficiency / duplicate search / deprecation check), invokes the debugger agent for the read-only RCA, proposes the bug issue (never creates without authorization).
argument-hint: <symptom | #N | stack trace | failing spec path>
allowed-tools: mcp__github__issue_read, mcp__github__search_issues, mcp__github__list_issues, mcp__github__issue_write, mcp__github__add_issue_comment, mcp__codegraph__codegraph_search, mcp__codegraph__codegraph_explore, mcp__codegraph__codegraph_callers, mcp__codegraph__codegraph_impact, Read, Write, Edit, Grep, Glob, Bash, Task
---

<Coordinator name="debug" stage="Bug signal → RCA → proposed bug issue (invokes the debugger agent)">
You coordinate the ONE bug door: every bug signal enters here — a raw symptom with no issue, an
existing GitHub issue, a pasted stack trace or compiler diagnostic, or a failing test. You detect
which (the `<InputDetection>` table) and apply that route's protocol.

In every route the **`debugger`** agent is the executor of the deep RCA — **you do not replicate
its work; you invoke the agent.** You load the `bug-diagnosis` skill as the process guide (the
deprecation check, evidence before assertion, the reproduction ladder, the certainty bar) and the
`github-issues` skill for the Mode B shape and the authorization contract.

**Always propose; never create or comment without authorization.**
</Coordinator>

<Input>
`$ARGUMENTS` — the bug signal, in one of its forms. How to invoke the debugger, which reproduction
routes exist, and what evidence to gather are stable facts (the `bug-diagnosis` skill) — not
parameters.
</Input>

<InputDetection reason="deterministic routing — apply in order, first match wins">
| # | Input matches | Route |
|---|---|---|
| 1 | `#123`, a bare number, or a repository issue URL | **Issue route** — a report already exists. |
| 2 | A path to a spec file, or output containing `FAIL`/`●`/a Jest assertion | **Failing-test route** — the failure output is the capture and most of the evidence. |
| 3 | A pasted stack trace, or a compiler diagnostic (`TS####`) | **Symptom route**, with the verbatim text as the capture. |
| 4 | A `github.com/.../discussions/N` URL | Read it; treat its content as an inbound report → **Symptom route**, carrying the link. |
| 5 | Anything else (free text describing a misbehaviour) | **Symptom route**. |
| 6 | Free text describing something that **does not exist yet** ("there's no retry option") | Not a bug. **Redirect `/constitution`** — a missing capability is Mode C, not a defect. |

Rows 5 and 6 are the pair most often confused. The test: **does something exist and behave wrongly
(bug), or does it not exist (capability)?**
</InputDetection>

<Musts reason="identify the minimum needed to not guess critical parts, then continue and propose">
The must here is **enough signal to diagnose**.

- **Symptom route**: what fails, which export or decorator, which transport, expected vs actual.
- **Issue route**: reproduction steps, the three versions (`@nestjs-mcp/server`, `@nestjs/common`,
  `@modelcontextprotocol/sdk`), the transport, expected vs actual. If a critical piece is missing →
  **propose asking in the issue's comments** and do **not** advance to the RCA until it is
  answered.
- **Failing-test route**: the full failure output, not the first line.

Once the musts are met, **continue and run the diagnosis** (via the agent). **Never invent or
assume** a cause, a reproduction, a duplicate, or a fix. `CLAUDE.md`: *"A fix grounded in
`[Inference]` is not done — get the evidence or say you couldn't and stop."*
</Musts>

<Process>

**Issue route — an existing GitHub issue.**
0. **Check the workspace** — `.project/tasks/issue-<N>/notes.md`. If it exists, read it **before
   investigating**. It records what was already tried and ruled out; re-running a dead end is the
   specific waste it exists to prevent. If `spec.md` exists too, this issue already has an approved
   analysis — say so, because a new RCA may invalidate it.
1. **Read the issue and its comments** (`issue_read`, `get` then `get_comments`) — what the
   reporter describes, in their words. The comments usually carry the versions and the "it also
   happens when…" that the body lacks.
2. **Judge report sufficiency** against the Musts. If a critical piece is missing → **propose a
   comment** asking for it (`add_issue_comment`, under authorization — commenting on a public issue
   is a mutation) and **do NOT advance to the RCA** until it is answered. Never assume the missing
   facts.
3. **Light discovery.** `search_issues` for another issue on the same symptom, **open and closed**.
   A match → **STOP and raise it with a recommendation** (add evidence to the existing one vs open
   a new one); a **closed** match means a **regression** — a new issue linking back, never a reopen.
   Then continue at the **Shared close**.

**Failing-test route — a red spec or CI run.**
1. **Capture the full output** verbatim — Jest's assertion diff usually names the broken invariant
   directly.
2. **Establish whether it is a product defect or a test defect.** A spec asserting behaviour the
   SPEC never promised is a test bug, and saying so is the finding.
3. **Light discovery** as above, then continue at the **Shared close**.

**Symptom route — a raw symptom, a stack trace, or a diagnostic.**
1. **Capture verbatim** (Phase 0 of `bug-diagnosis`) — the exact string, the versions, the
   transport, expected vs actual. Ask for anything missing rather than filling it in.
2. **Light discovery** — `search_issues` for the same symptom before investigating, open and
   closed. If one exists → raise it with a recommendation; do not open a parallel. Then continue at
   the **Shared close**.

**Shared close — every route ends here.**
3. **The `debugger` agent runs the read-only RCA.** Invoke it via Task. It runs the deprecation
   check first, builds the smallest reproduction that fails (climbing the ladder: unit spec → e2e →
   MCP Inspector → example), traces the cause with codegraph, and attributes it correctly
   (first-party vs `@modelcontextprotocol/sdk` vs consumer misuse). The deep investigation is the
   debugger's — never done inline by a coordinator.

4. **Preserve the investigation before judging it.** An RCA is expensive and, until now, evaporated
   whenever it did not end in an issue — which is most of the interesting outcomes below. When the
   signal is an existing issue `#N`, **append the finding to `.project/tasks/issue-<N>/notes.md`**
   (creating the directory and file if needed), per the `task-workspace` skill: what was tried,
   what it ruled out, and any surprising SDK behaviour. Append — never rewrite; the dead ends are
   the point.

   For a symptom with no issue behind it there is no workspace to write to. Say so, and if the
   finding is worth keeping, that is itself an argument for opening the issue.

5. **Judge the outcome before proposing anything.** Not every RCA ends in an issue:
   - **Path deprecated / already fixed on `main`** → report that, with the version that fixed it.
     **No issue.**
   - **Consumer misuse the types already reject** → that is a documentation gap (Mode D), not a
     bug. Propose accordingly.
   - **Upstream SDK bug** → the issue here records the wrapping decision (pin / override / wrap /
     wait) and links the upstream report. Say which, with its consequence.
   - **Not reproducible** → say so, with the routes tried and the settings used. An honest
     `Not reproducible` is a valid outcome; a plausible guess is not.
   - **Cause proven** → propose the bug issue.

6. **On a proven cause, propose the issue** per the `github-issues` skill (Mode B,
   `templates/bug.md`), carrying the RCA's `Root cause` with its confidence tag, the reproduction
   outcome state verbatim, the affected `file:line`, and acceptance criteria including *a
   regression test that fails without the fix*.

7. **Authorization gate.** Present the **full drafted issue** — exact title, complete body, exact
   labels — and **wait for explicit OK**, per the `github-issues` skill's `<Authorization>`
   contract. Create or comment only on authorization.

8. **After creating, close the loop** (the skill's `<PostCreate>`): report `#<N>` with its URL and
   the branch name the fix will use (`bugfix/issue-<N>-<desc>`). If a call failed — a label
   rejected, a comment not posted — **report the failure** rather than the number alone.
</Process>

<Handoff>
A proposed-and-created bug issue goes to `/specification <#N>` when the fix needs technical
analysis (a public-API or SemVer consequence, a non-trivial approach), or straight to
`/develop <#N>` when the SPEC would be a formality and the cause is a proven one-liner. The RCA
lives on the issue either way — `/specification` references it, never repeats it.
</Handoff>

<References>
  <Ref skill="bug-diagnosis" reason="The five-phase protocol every route coordinates — capture verbatim, the blocking deprecation check, the reproduction ladder and its outcome states, the certainty bar, and the diagnostic matrix." />
  <Ref skill="task-workspace" reason="Where notes.md lives, the append-only rule, and the entry shapes worth using for a dead end, a ruled-out approach, or surprising SDK behaviour." />
  <Ref skill="github-issues" reason="Mode B anatomy and templates/bug.md, the duplicate-check query, the label rules, and the per-batch authorization for the issue and any comment." />
  <Ref doc="CLAUDE.md" reason="The honesty bar on [Unverified]/[Inference], the core resolver/guard patterns the diagnosis keys off, and the no-autonomous-git non-negotiable." />
</References>
