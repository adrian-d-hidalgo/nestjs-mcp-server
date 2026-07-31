---
description: The single entry door — derive a proposed GitHub issue from a requirement, which can be free text, a GitHub Discussion, or an inbound report. Detects the input type deterministically, duplicate-checks before anything else, writes verifiable acceptance criteria, proposes (never creates without authorization).
argument-hint: <requirement text | #N | discussion URL>
allowed-tools: mcp__github__search_issues, mcp__github__issue_read, mcp__github__list_issues, mcp__github__get_label, mcp__github__issue_write, mcp__github__add_issue_comment, mcp__codegraph__codegraph_search, mcp__codegraph__codegraph_explore, Read, Grep, WebFetch
---

<Coordinator name="constitution" stage="Requirement → proposed GitHub issue">
You coordinate the SINGLE entry door of the delivery pipeline: turning a **requirement** into a
GitHub issue in `adrian-d-hidalgo/nestjs-mcp-server`. The requirement arrives as free text, a
GitHub Discussion, or an inbound report — you detect which (the `<InputDetection>` table) and apply
that route.

This command produces **an issue and nothing else**. Issue creation stays high-level: the technical
SPEC (code, approach, the Public API and SemVer calls) is authored later by `/specification`. You
load the `github-issues` skill for the modes, labels, templates, duplicate check, and the
authorization contract — you never fork its rules.

**Always propose; never create without explicit authorization.**
</Coordinator>

<Input>
`$ARGUMENTS` — the requirement, in one of its forms. The repository, the label taxonomy, the mode
selection rules, the duplicate-check query, and the issue creation flow all live in the
`github-issues` skill — you load and apply them, you do not re-list or invent them.
</Input>

<InputDetection reason="deterministic routing — apply in order, first match wins; never route by vibes">
| # | Input matches | Route |
|---|---|---|
| 1 | `#123`, a bare number, or a `github.com/.../issues/123` URL | Already an issue. **Redirect**: `/specification 123` (no SPEC yet) or `/develop 123` (SPEC exists — check with `issue_read`). Never re-create it. |
| 2 | A `github.com/.../discussions/N` URL | Read it (`WebFetch`); its content is the requirement text → **Route B**, carrying the discussion link as the evidence. |
| 3 | A `github.com/.../pull/N` URL | A PR is not a requirement. **Redirect**: ask what the requirement behind it is, or use `/review`. |
| 4 | Free text describing an **observed misbehaviour** ("it throws", "the tool never appears", "the session drops", a pasted stack trace) | **Redirect `/debug`** — that is the bug door. Bugs need an RCA before they need an issue. |
| 5 | Free text describing a **capability, a technical change, or a gap** | **Route B** — derive one issue. |
| 6 | Anything else (too vague to classify) | Ask which of the above it is. Do not guess a mode. |

Routes 4 and 5 are the pair most often confused. The test: **does something already exist and
behave wrongly (→ `/debug`), or does something not exist yet (→ Route B)?** "The retry logic is
wrong" is a bug; "there is no retry logic" is a capability.
</InputDetection>

<Musts reason="identify the minimum needed to not guess critical parts, then continue and propose">
Here the musts are understanding the requirement at the requirement level: its **current state**,
its **target state**, and **why** — plus enough to write acceptance criteria a reader could verify.

Once met, continue and propose. Anything the source leaves unresolved (an exact option name, a
default value) is carried as an acceptance criterion to verify, **not invented as a fact**. For
anything unclear, **ask**; never invent scope, coverage, a relationship, or the closure condition.

**Maturity gate.** A requirement too vague to derive verifiable acceptance criteria from is not a
requirement yet — **STOP and ask the specific question that would make it one**. Never invent the
missing layer to produce a well-formed issue: a well-formed issue built on an invented premise is
worse than no issue, because it looks decided.

**Code inspection is allowed and often required** — for a technical task (Mode T) or a refactor
(Mode R), the truth of the current state lives in the code. Use codegraph. But the *file-level
approach* still belongs to `/specification`, not here.
</Musts>

<Process>

**Route B — the requirement (free text, or the content of a discussion) → ONE issue.**

1. **Understand the work.** State the real **current state → target state → why** at the
   requirement level. For Mode T / Mode R, read the actual code with codegraph to state the current
   state accurately — never from memory.

2. **Duplicate check FIRST, before drafting.** Run the `github-issues` skill's duplicate-check
   query, **open and closed**. Drafting before checking wastes the draft and biases you toward
   creating it. On any plausible match → the conflict gate (step 5).

3. **Choose the mode** per the `github-issues` skill's `<IssueTemplates>`:
   `enhancement` (C, a capability) · `refactor` (R, no public-API change) · `security` (S) ·
   `documentation` (D) · `chore` (T, technical task, or X, accepted debt). Mode B (bug) does not
   arrive here — it arrives via `/debug`.
   The mode fixes the title shape, the labels, and the body template. Do not mix them.

4. **Draft against the mode's template** — the section headers and order of the corresponding
   `.github/ISSUE_TEMPLATE` form, with reporter-only fields dropped rather than invented (the
   skill's `<ReporterOnlyFields>`).

   **Write verifiable acceptance criteria**: what a **consumer of the package** can do / see /
   stop seeing. Gherkin when the capability has conditional states; a checklist otherwise. For
   Mode T / Mode R / Mode X, acceptance is technical — `Current state` → `Target state` + a
   checkable `Closure condition`.

5. **Conflict gate.** On a duplicate, a contradiction, or an overlap: **halt, present
   existing-vs-new with a recommendation, never act silently.** A closed issue matching the same
   symptom means a **regression** — a new issue linking back, never a reopen.

6. **Cardinality: exactly ONE issue.** If the text carries several independent deliverables, **say
   so and ask** — never fan out silently. There are no sub-issues in this repository: one issue is
   one unit of work.

7. **Authorization gate.** Present the **full draft** — the exact title, the complete body, the
   exact label list, and any `Related: #N` / `Blocked by #N` lines — and **wait for explicit OK**,
   per the `github-issues` skill's `<Authorization>` contract. A summary is not a draft.

8. **Create only on authorization** — `issue_write` with `method: "create"`. Then close the loop
   per the skill's `<PostCreate>`: report `#<N>` with its URL, the branch name the work will use
   (`feature/issue-<N>-<desc>` or `bugfix/issue-<N>-<desc>`), and **any call that failed** rather
   than the number alone.
</Process>

<Handoff>
The issue carries no technical spec — the next stage is `/specification <#N>`, which authors the
SPEC (including the Public API and SemVer calls) into the issue body. Then `/develop <#N>` plans
and executes the development against that SPEC.
</Handoff>

<References>
  <Ref skill="github-issues" reason="Modes and template mapping, the label taxonomy and the never-invent-a-label rule, the duplicate-check query, the issue creation flow, the certainty bar, and the authorization contract every route applies." />
  <Ref skill="bug-diagnosis" reason="The boundary this command routes away from — an observed misbehaviour needs an RCA before it needs an issue." />
  <Ref doc="CLAUDE.md" reason="The honesty bar on unverified claims, and the prohibition on time estimates in any drafted body." />
</References>
