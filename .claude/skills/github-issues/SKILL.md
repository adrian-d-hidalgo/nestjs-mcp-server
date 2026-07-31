---
name: github-issues
description: "Persisting confirmed bugs and work as GitHub Issues in adrian-d-hidalgo/nestjs-mcp-server: the label taxonomy, the mapping from .github/ISSUE_TEMPLATE forms to maintainer-authored bodies, the certainty bar, duplicate check, linking conventions, the mutation-authorization contract, and the GitHub MCP tool mechanics. Load when creating, updating, commenting on, or tracking a GitHub issue."
---

<Purpose>
Install the reflex of turning a confirmed bug, a missing capability, or a structural gap into a
correctly-shaped GitHub issue — and nothing on speculation. An issue in a public repository is a
public commitment to act, so this skill governs the whole path: which template and labels the work
lands under, the certainty bar that gates creation, the per-mode body anatomy, the duplicate check
that runs before every creation, the mutation-authorization rule, and the closing-the-loop
protocol. An issue is created AFTER diagnosis confirms the problem applies to current `main` —
skipping that step produces issues for code that no longer exists.
</Purpose>

<WhenToUse>
  <Trigger>About to create a GitHub issue for a confirmed bug, a missing capability, a refactor, or a technical-debt item.</Trigger>
  <Trigger>Updating, commenting on, labelling, linking, or closing an existing issue.</Trigger>
  <Trigger>Running the duplicate check, or deciding whether two open issues are the same problem.</Trigger>
  <Trigger>Looking up which label / issue template / body shape a piece of work belongs to.</Trigger>
  <Trigger>Choosing which `github` MCP tool to call for a search / read / create / update action.</Trigger>
  <Trigger>Loaded by a slash-command coordinator (`/constitution`, `/specification`, `/develop`, `/debug`) — a valid entry point alongside the agents.</Trigger>
</WhenToUse>

<CachedFacts>
Repository facts are cached so agents do NOT re-discover them on every run. Re-verify only when
you suspect the repository was renamed or its labels were reorganised.

  <Repository>
| Field | Value |
| --- | --- |
| `owner` | `adrian-d-hidalgo` |
| `repo` | `nestjs-mcp-server` |
| Package | `@nestjs-mcp/server` (published to npm) |
| Default branch | `main` |
| Blank issues | **Disabled** (`.github/ISSUE_TEMPLATE/config.yml`) — every issue comes from a form |
| Questions | Redirected to GitHub Discussions, not issues |

There is one repository and one published package. There are **no subrepos**, so there is no
work breakdown into sub-issues and no per-area split: **one issue is one unit of work.** If a
requirement genuinely carries two independently-shippable deliverables, that is two issues — say
so and ask; never fan out silently.
  </Repository>

  <IssueTemplates reason="the forms in .github/ISSUE_TEMPLATE are the source of truth for issue shape — this skill maps onto them, it never re-authors them">
Five forms exist. Each pins its own title prefix and labels; **do not override them**.

| Form | Mode | Title prefix | Labels the form applies | Use when |
| --- | --- | --- | --- | --- |
| `bug_report.yml` | **B** — bug | `[Bug]: ` | `bug`, `triage` | Defect in shipped code (any severity). |
| `feature_request.yml` | **C** — capability | `[Feature]: ` | `enhancement`, `triage` | A capability the package should have but doesn't yet. |
| `refactoring.yml` | **R** — refactor | `[Refactor]: ` | `refactor`, `triage` | Internal restructuring with **no public-API change**. |
| `security.yml` | **S** — security | `[Security]: ` | `security`, `triage` | Non-critical vulnerability. Critical ones go to private disclosure, never here. |
| `documentation.yml` | **D** — docs | `[Docs]: ` | `documentation`, `triage` | README / API reference / examples / TSDoc gaps. |

**Mode T — technical task** has **no form**. Dependency bumps, toolchain migrations, CI changes
and release-plumbing work are authored by hand under the `chore` label (that is why issues #119,
#113 and #112 carry no `[Prefix]:`). Its body shape lives here, in `templates/task.md`. Mode T
titles use a Conventional-Commits-shaped subject instead of a bracket prefix — e.g.
`chore(deps): migrate to TypeScript 6` — matching what is already in the repository.

**Mode X — technical debt** also has no form. It is a Mode T issue with a mandatory
`Closure condition`; see the Debt pattern below.

  <SurfaceReduction reason="the case the table handles badly — recorded rather than papered over">
**Removing or narrowing something already exported** — retiring an accidental export, tightening a
type — has no clean home here, and you should know that before forcing it into one.

It is **not Mode R**: that mode's defining test is that the public API stays byte-identical. It is
not a new capability either, so `[Feature]:` and `enhancement` read backwards on a change that takes
things away.

**Use Mode C anyway**, and say why in the body's first line. The reason is that the mode drives the
**SemVer treatment**, and Mode C's is the correct one: a removed or narrowed export is `feat!` →
MAJOR. Getting the label slightly wrong is cosmetic; getting the version wrong ships a break as a
minor.

Two things to state explicitly in such an issue, because the template will not prompt for them:
- **what a consumer must edit**, with a before/after — the whole point of the MAJOR
- **whether the symbol was ever intended as API**, or leaked through a blanket `export *`. Those are
  different conversations: retiring a designed export needs a migration path, retiring an accidental
  one mostly needs an explanation.
  </SurfaceReduction>
  </IssueTemplates>

  <ReporterOnlyFields reason="the forms are written for external reporters; a maintainer-authored issue does not answer reporter questions">
These fields exist to qualify an inbound report. When **you** author the issue, they are dropped —
not answered with invented values, and not answered on the reporter's behalf:

| Field | In a maintainer-authored issue |
| --- | --- |
| `Prerequisites` checkboxes | **Dropped.** The duplicate check already ran (see the Duplicate check workflow); say so in `Notes` instead. |
| `Code of Conduct` / `Responsible Disclosure` checkboxes | **Dropped.** They are a submission gate, not content. |
| `Contribution` ("I'm willing to submit a PR") | **Dropped.** |
| `Package Version` / `NestJS Version` | Only when the issue describes behaviour observed at a specific version. Otherwise `current \`main\` @ <short sha>`. |
| `Environment` / `Environment Details` | Only for a bug actually observed in an environment. `N/A — reproduced from the test suite` is a valid, honest answer. |
| `Estimated Effort` (refactor form) | **Dropped.** Time estimates are a non-negotiable prohibition in `CLAUDE.md`. State scope instead ("touches 3 decorators", "requires an SDK type change"). |
| `Impact Level` | Kept — it is the input to the priority label. |

Everything else on the form is real content and is filled per the mode's template.
  </ReporterOnlyFields>

  <Labels>
The labels below **exist today**. Creating a label is a repository mutation — never invent one.
Before applying any label not on this list, confirm it exists with `get_label`; if it does not,
propose creating it to the user and wait, or leave it off.

| Label | Meaning | Applied by |
| --- | --- | --- |
| `bug` | Defect in shipped code | `bug_report.yml` |
| `enhancement` | New capability | `feature_request.yml` |
| `refactor` | Internal restructuring, no API change | `refactoring.yml` |
| `security` | Vulnerability or hardening | `security.yml` |
| `documentation` | Docs / examples / TSDoc | `documentation.yml` |
| `chore` | Technical task — deps, toolchain, CI, release plumbing | **manually (Mode T)** |
| `devops` | CI/CD and workflow changes | manually, alongside `chore` |
| `triage` | Not yet assessed by a maintainer | every form |
| `priority: high` | See Priority | manually |
| `priority: medium` | See Priority | manually |
| `priority: low` | See Priority | manually |
| `released on @rc` | Shipped in a pre-release | semantic-release automation — **never set by hand** |
| `high-priority` | **Legacy.** Superseded by `priority: high`. | — do not apply to new issues |

**Rules:**
- A maintainer-authored issue carries **exactly one type label** (`bug` / `enhancement` /
  `refactor` / `security` / `documentation` / `chore`). Two type labels means it is two issues.
- `triage` means "a maintainer has not assessed this yet". When *you* author the issue after a
  diagnosis or a specification, it is already assessed — **omit `triage`** and state why in the
  proposal. When you file an inbound report on someone's behalf, keep it.
- Never set `released on @rc`. It belongs to the release automation (`.releaserc.js`).
- **This table is not exhaustive** — it lists what has been observed, and the repository has more
  labels than any single query returns. Before applying a label that is not here, confirm it with
  `get_label`; before concluding a label does *not* exist, confirm that too. `priority: low` was
  once documented here as non-existent on the strength of a 20-issue sample; issue #30 carries it.
  A negative claim from a partial listing is not evidence.
  </Labels>
</CachedFacts>

<Conventions>

- **English only.** This is a public repository with a published npm package; titles, bodies, and
  comments are English throughout. (Two 2025-era issues are in Spanish — they are legacy, not the
  convention.)
- **Code and error text is verbatim.** Compiler diagnostics (`TS2589`), SDK error strings, stack
  frames, and identifiers are pasted exactly as emitted, never paraphrased or translated.
- **Section headers are `##`**, matching the labels of the corresponding form field
  (`## Bug Description`, `## Expected Behavior`, `## Steps to Reproduce`, …) so a
  maintainer-authored issue reads identically to a form-submitted one.
- **Cross-references use GitHub's own syntax.** `#123` auto-links; `Closes #123` in a PR or commit
  footer closes on merge. Do not restate another issue's body — link it.
- **Code blocks are fenced and tagged** (` ```typescript `, ` ```shell `) — the forms already
  `render:` those field types, so hand-authored bodies must match.

</Conventions>

<Priority>
Priority is a label, and only two values are confirmed to exist.

| Label | Trigger |
| --- | --- |
| `priority: high` | Breaks a core flow for consumers with no workaround · a security issue rated High · blocks a release. |
| `priority: medium` | Default for accepted work with a known workaround or limited blast radius. |
| `priority: low` | Nice-to-have, no consumer impact, blocks no release. |
| _(none)_ | Unassessed. Absence of a priority label is a valid state — do not invent one to look thorough. |

Never bump priority on assumption. Missing impact data → no priority label + a line in `Notes`
saying what is unknown. Map the forms' `Impact Level` dropdown as: `Critical`/`High` →
`priority: high`; `Medium` → `priority: medium`; `Low` → `priority: low`.
</Priority>

<CertaintyBar>
A public issue commits the project to act, in front of users. Don't open one on speculation.

**No assumptions, ever.** Every claim in the body (Bug Description, Root cause, Steps to
Reproduce, Current Implementation, affected files) must be grounded in evidence: a failing test, a
`codegraph`/`grep`-verified code path, an observed reproduction, a pasted compiler diagnostic, or
an explicit reporter quote. If a section can't be filled with evidence, **don't invent it** —
write the real outcome (`Reproduction blocked`, `Root cause: [Unverified] until X is validated`)
or don't open the issue yet. This is the same bar `CLAUDE.md` sets: *"Compiling is not executing;
types verify code, not behavior."*

Before creating, **all yes**:
- [ ] The problem is real on **current `main`** (the deprecation check from `bug-diagnosis` passed).
- [ ] Reproduced — by a failing spec, an e2e run, an MCP Inspector session, or a running example —
      **or** evidence sufficient to identify the cause. ("It would make sense that…" does not count.)
- [ ] Root cause / current state names a specific file, symbol, or invariant — not a guess.
- [ ] Impact is stated in terms of what a consumer of the package observes, not estimated.

Any `no` / `unknown` → don't create. Either continue diagnosing or ask the user.

  <AskTheHuman>
Common gaps and what to request — be specific:

| Gap | Ask for |
| --- | --- |
| Report has no reproduction | The minimal `McpModule.forRoot` config plus the resolver that triggers it |
| Version unknown | `@nestjs-mcp/server`, `@nestjs/common`, and `@modelcontextprotocol/sdk` versions from their lockfile |
| Protocol era unclear | Which era they negotiated — `2026-07-28` (stateless, no handshake) or the 2025 legacy fallback |
| Screenshot or video only | Ask for the text of the error and the surrounding stack frames |
| Type error reported | The exact `tsc` diagnostic, verbatim, plus their `tsconfig.json` `strict` settings |

❌ "Send more info". ✅ "Can you paste the exact `tsc` output and your `paramsSchema` definition
for the failing tool?" If the user can't provide it, **park** — don't synthesize.
  </AskTheHuman>

  <LowCertaintyPlaceholder>
Only when the user explicitly says "open it as a placeholder anyway":
- Mark every section without evidence as `[Unverified]`.
- Apply no priority label regardless of claimed impact.
- Add a `## Pending evidence` section listing exactly what is missing.

This is the only acceptable form of low-certainty issue.
  </LowCertaintyPlaceholder>
</CertaintyBar>

<Authorization>
Creating, updating, labelling, closing, or commenting on a GitHub issue is a **public,
shared-state mutation** — agents do not perform mutations autonomously. This block is the
canonical authorization contract; the commands cite it rather than re-author the semantics.

**Show in full, then wait.** Before any mutation, present the **complete drafted content** (the
full title, the full body, the exact label list — not a summary) and **wait for an explicit OK**.
An approval authorizes **only what was shown in full** — "continue" / "create" / "looks good"
never authorizes content the user has not seen.

**An OK is scoped.** "Create the issue" authorizes a single, scoped artifact or batch. It does
**not** authorize:
- Re-running creation if it failed partway (ask).
- Creating extra issues you noticed along the way.
- Commenting on, labelling, or closing other issues.
- Any `git` operation. Per `CLAUDE.md`, `git commit` / `git push` / `git reset --hard` /
  `git rebase` / publishing require the user to type the command themselves. "Finish the task" is
  not authorization.
</Authorization>

<Tools>
The `github` MCP server owns the tool layer (HOW to send a request); this skill owns the issue
domain (WHAT goes in each field). Pass `owner` / `repo` from CachedFacts on every call.

  <ToolsByIntent>
| Action | Call |
| --- | --- |
| Duplicate check | `mcp__github__search_issues` with the query in Queries |
| Read an issue | `mcp__github__issue_read` (`method: "get"`) |
| Read its comments | `mcp__github__issue_read` (`method: "get_comments"`) |
| List by label / state | `mcp__github__list_issues` (use `perPage: 10`; the full list overflows context) |
| Confirm a label exists | `mcp__github__get_label` |
| Create an issue | `mcp__github__issue_write` (`method: "create"`) with `title`, `body`, `labels` |
| Update body / labels / state | `mcp__github__issue_write` (`method: "update"`) |
| Comment | `mcp__github__add_issue_comment` |
| Close as duplicate | `mcp__github__issue_write` with `state: "closed"`, `state_reason: "duplicate"`, `duplicate_of: <N>` |
  </ToolsByIntent>

  <BodyUpdateMechanic reason="the single most damaging mistake this skill can prevent — and two traps verified against the live repository on 2026-07-29">
`issue_write` with `method: "update"` **replaces `body` wholesale**. It has no append mode.

Therefore, before any body update: **`issue_read` first, then send the full new body.** Never
construct an update body from memory or from the proposal alone — you will silently delete the
reporter's words.

**TRAP 1 — the read path escapes HTML entities; the stored body does not contain them.**
`issue_read` returns `&#34;` for `"`, `&#39;` for `'`, `&gt;` for `>`, `&amp;` for `&`. These are
an artifact of the MCP server's sanitiser, **not** what GitHub stores — verified by comparing a
read against the rendered page. So: **unescape them before echoing the body back in an update.**
Writing the escaped form re-escapes it for real and corrupts the reporter's text — a quote becomes
a literal `&#34;` on a public issue.

**TRAP 2 — HTML comments are stripped on read, so they cannot be used as sentinels.**
A `<!-- MARKER -->` written into a body does not come back from `issue_read`. GitHub stores it
(HTML comments in issue bodies are standard bot practice), but this tool cannot see it. An
invisible sentinel you cannot read back is not a sentinel: the next run finds no marker and appends
a duplicate. **Any machine-managed region in an issue body would need a VISIBLE delimiter** — a
markdown heading survives both storage and the sanitiser; a comment does not.

  <NothingInThePipelineUpdatesABody reason="stated so the traps above are never treated as a licence to build on them">
**No command in this pipeline writes to an issue body.** The mechanic above exists because
`issue_write` *can* update a body, and if you are ever asked to, the traps will bite. It is not a
workflow anyone here follows.

Specifically, **the technical SPEC does not go in the issue.** It is a file —
`.project/tasks/issue-<N>/spec.md` — and the issue is read, never written: no SPEC, no summary of
it, no pointer to it, no managed block. The requirement belongs to whoever wrote the issue; the
analysis of how to satisfy it belongs to the workspace. Two artifacts with two owners cannot
disagree with each other, and that is the entire reason for the split.

`/specification` has **no GitHub write tool** in its `allowed-tools`, so this is enforced and not
merely advised.

What the pipeline *does* write to GitHub: **new issues** (`/constitution`, `/debug` — `create`, not
`update`) and **comments** (`/debug`, when asking a reporter for missing information). Both are
additive and neither needs to reconstruct an existing body.

If a decision in a SPEC genuinely needs to reach a contributor — the change is breaking, the issue
is blocked on an unanswered design question — the right move is to **tell the user and let them
comment**. Publishing from the private workspace is the maintainer's call, never an automatic side
effect.
  </NothingInThePipelineUpdatesABody>
  </BodyUpdateMechanic>
</Tools>

<Patterns>

  <Pattern name="Mode B — bug">
A defect in shipped code. Form: `bug_report.yml`. Labels: `bug` (+ `triage` only when filing an
inbound report on someone's behalf). Body: `templates/bug.md`.

**Title** — copies the observable failure, verbatim where the failure has an exact string. Keep
technical identifiers exactly as emitted: error codes (`TS2589`), SDK symbol names, HTTP status,
exact option names.

```
✅ [Bug]: Type instantiation is excessively deep and possibly infinite
✅ [Bug]: Session ID is not propagated to the handler on streamable HTTP reconnect
❌ [Bug]: Something wrong with tools          (loses the search keyword)
❌ [Bug]: Fix the session store               (prescribes a fix before diagnosis)
```

**Rules:**
- `Root cause` requires evidence — a `file:line` from `codegraph`/`Read`, or the compiler
  diagnostic. Never "TBD"; defer creation instead (see CertaintyBar).
- `Steps to Reproduce` carries a **reproduction outcome state** when you did not reproduce it:
  `Reproduced` / `Not reproducible` / `Reproduction blocked` / `Not reproduced` (from
  `bug-diagnosis`). An empty section is a lie by omission.
- `Error Logs` is fenced ` ```shell ` and shows first-party frames only — never a whole
  `node_modules` stack.
- Acceptance criteria describe what a **consumer of the package** can do / stop seeing. For a
  purely internal defect (a leaked timer, a test flake), an internal criterion is fine — but
  justify in one line why it is not consumer-facing.
  </Pattern>

  <Pattern name="Mode C — capability">
A capability the package should have but doesn't yet. Form: `feature_request.yml`. Label:
`enhancement`. Body: `templates/feature.md`.

It is **not** a bug: no `Root cause`, no `Steps to Reproduce`, no stack trace. If you find
yourself writing those, it is a bug → Mode B.

**Rules:**
- `Usage Example` is mandatory and is the heart of the issue: the TypeScript a consumer would
  write once the capability exists. It is the API proposal in its most reviewable form — write it
  before the prose, and make it compile-plausible against the real exports in `src/index.ts`.
- `Alternatives Considered` names the paths not taken. "None" is almost always a sign the design
  was not explored.
- Any `file:line` cited must be `codegraph`- or `grep`-verified, same bar as CertaintyBar.
- Acceptance criteria in Gherkin when the capability has conditional states (opt-in gating,
  transport-dependent behaviour, cascading defaults); a flat consumer-facing checklist otherwise.
  </Pattern>

  <Pattern name="Mode R — refactor">
Internal restructuring that leaves the public API **byte-identical**. Form: `refactoring.yml`.
Label: `refactor`. Body: `templates/refactor.md`.

The form's own prerequisite says it: *"I have verified this refactoring doesn't change public API
or break existing functionality."* That is the defining test.

- If the exported surface changes at all → it is **not** Mode R. A widened type is Mode C
  (`feat`); a narrowed or removed one is Mode C with a breaking change (`feat!`).
- `Current Implementation` and `Proposed Implementation` carry real code, fenced
  ` ```typescript `, read from the repository — not sketched from memory.
- `Package Area` uses the form's own vocabulary (Core Module · Decorators · Guards · Session
  Management · Transports · Infrastructure · Testing · Documentation).
- Drop `Estimated Effort` — no time estimates (`CLAUDE.md`).
  </Pattern>

  <Pattern name="Mode S — security">
A **non-critical** vulnerability or hardening item. Form: `security.yml`. Label: `security`.
Body: `templates/security.md`.

**Blocking gate:** if the vulnerability is critical — remotely exploitable, or exposing consumer
secrets or host filesystem — it must go through **private disclosure**, not a public issue. Stop
and tell the user; do not draft a public issue that hands out a working exploit.

- `Severity Assessment` uses the form's three values (Low / Medium / High). "Critical" is
  deliberately absent from the form — that is the private-disclosure signal.
- Most security work in this repository is **dependency advisories**, and the transitive-source
  fact matters: advisories here have historically come through `@modelcontextprotocol/sdk`, not
  first-party code. State which, with the resolution path, in `Vulnerability Description`.
- `Reproduction Code` must not be a weaponised exploit — the minimum that demonstrates the flaw.
  </Pattern>

  <Pattern name="Mode D — documentation">
A gap in README, API reference, TSDoc, or `examples/`. Form: `documentation.yml`. Label:
`documentation`. No dedicated body template — the form's own sections (`Current Documentation
State` · `Documentation Proposal` · `Example Code`) are the body.

Ships as a `docs:` commit → **no release** (`.handbook/GIT_GUIDELINES.md`). Say so in `Notes`, so
nobody waits for a version bump that will not come.
  </Pattern>

  <Pattern name="Mode T — technical task (no form exists)">
Engineering work that is neither a defect nor a consumer-facing capability: dependency bumps,
toolchain migrations (TypeScript, Node runners), CI/workflow changes, release plumbing, build
config. Label: `chore` (plus `devops` when it lands in `.github/workflows/`). Body:
`templates/task.md`.

**Title** — Conventional-Commits-shaped, no bracket prefix, matching the existing convention:

```
✅ chore(deps): migrate to TypeScript 6
✅ ci(workflows): bump GitHub Actions to Node 24 runners
❌ [Task]: update typescript                 (invents a prefix no form defines)
❌ Update deps                               (no scope, no type)
```

**Acceptance is technical and verifiable** — `Current state` → `Target state` → a checkable
`Closure condition`. No root cause (nothing is broken); no usage example (no consumer-facing
surface). Example closure: *"`pnpm typecheck` passes on TypeScript 6, `pnpm knip` reports no new
unused exports, and the five-phase gate is green."*

Code inspection **is** required here: a migration must read the current code to state
`Current state` accurately.
  </Pattern>

  <Pattern name="Mode X — technical debt">
An accepted, deferred gap. It is a Mode T issue (`chore`) whose `Closure condition` is the point
of the issue. There is no `debt` label in this repository — do not invent one; the closure
condition and the `chore` label carry it.

**Justified only when ALL four hold:**
1. **The gap is real today** — a `grep`, a `file:line`, a failing check, or a benchmark proves it.
2. **It is not a bug.** A bug is *wrong behaviour* for something that should already work. Debt is
   a *structural gap* — an accepted workaround, an upstream limitation, an incomplete migration.
   If a consumer observes a misbehaviour, it is Mode B.
3. **It is not a capability.** Closed scope with consumer-visible acceptance criteria is Mode C.
4. **It has a closure condition** — a verifiable trigger (`grep` returns 0, a suppressed
   `@ts-expect-error` can be deleted, an upstream release lands). Without one it is the status quo,
   not debt: document it in the relevant handbook file instead.

If any of the four fails, open the right artifact instead.

**In-code marker.** `// TODO(#<N>): <one-line summary>` helps a later reader discover the debt.
Add it **only when you are already editing that file** in the same change. Never open a change
just to add markers. When the debt closes, **remove the marker** as part of the closing change — a
marker outliving its issue is its own bug.
  </Pattern>

  <Pattern name="Linking issues">
GitHub has no typed issue links. The conventions that work:

| Relationship | How |
| --- | --- |
| This work closes that issue | `Closes #N` in the **commit footer / PR body** — never in the issue body, where it does nothing |
| Sequencing | A `Blocked by #N` line under `## Notes`; GitHub renders it as a live cross-reference |
| Loose relation | `Related: #N` under `## Notes` |
| Same problem, two issues | Close the weaker one via `issue_write` with `state_reason: "duplicate"` and `duplicate_of: <N>` |

A bare `#N` mention anywhere already creates a back-reference on the target issue — that is the
mechanism, and it means **mentioning an issue is itself a visible mutation on that issue's
timeline**. Do not scatter references casually.
  </Pattern>

</Patterns>

<ConsultAxes reason="single source — referenced by the flows that run consults">
A piece of work fires a consult axis when its scope matches the trigger. The flow runs the consult
and **records each non-consult with its reason** — collapsing is not bypassing.

| Axis | Fires when the work involves… | Consult |
| --- | --- | --- |
| Architecture | a new pattern, a change to a canonical pattern (`@Resolver`, decorator metadata, transport wiring), a dependency swap, or a change to the exported surface | the `specifier`'s own analysis, recorded in the SPEC's `Consults` section |
| Security | guards, session handling, transport-level input parsing, anything reading env or the filesystem, dependency advisories | **stage-dependent — see below** |
| Public API | anything the SPEC's `Public API impact` section is not `_n/a_` for | verify `examples/` still run (`EXAMPLE=<name> pnpm start:example`) |
| Quality | every diff, without exception | the `code-reviewer` agent |

**Which stage runs which axis:** `/constitution` runs **none** — it is high-level. `/specification`
runs **Architecture and Security**, recording both in the SPEC's `Consults` section. `/develop`
runs **Quality always**, plus **Security** and **Public API** when their triggers fire.

  <SecurityAxisByStage reason="the same axis needs two different consults, and using the wrong one produces noise instead of a finding">
The Security axis fires at two stages, and **the consult is not the same thing at each**:

| Stage | What exists | The consult |
| --- | --- | --- |
| `/specification` | a design, **no diff** | The `specifier`'s **design-level** analysis, written into the SPEC's `Consults` row: what the proposed shape exposes, whether it is being positioned as an authorization mechanism, what session-lifetime consequences it carries. |
| `/develop` | an actual diff | The built-in **`/security-review`** skill — **but read its limitation below before trusting the output.** |

**`/security-review` reviews the BRANCH, not your working diff — verified 2026-07-30.** It builds
its context from the branch's commits plus the uncommitted tree. On a branch that carries unrelated
commits, that is what it analyses: a run during issue #30 captured **238KB dominated by a dependency
bump from another issue**, and the actual change under review was a rounding error inside it.

So before invoking it, check what it will actually see:

```
git log --oneline main..HEAD     # unrelated commits on this branch?
git diff --stat                  # how big is the real change?
```

- **Branch carries only this issue's work** → run it; the output is about your change.
- **Branch carries unrelated commits** → its output will be dominated by them. Either review the
  real diff directly against the axes below, or say plainly in the verification record that the
  tool was not usable here and what you did instead. **Do not paste a branch-wide report and call
  it a review of this change** — that is the failure mode this note exists to prevent.

**Do not run `/security-review` from `/specification`.** It reviews the working diff, and at SPEC
time there is none — it would review whatever unrelated changes happen to be uncommitted and report
findings with nothing to do with the issue. Record the design-level finding instead, and note in the
SPEC that the diff review is owed at `/develop`. Skipping the tool is correct here; skipping the
*thinking* is not.
  </SecurityAxisByStage>
</ConsultAxes>

<Workflow name="Issue creation flow" reason="shared spine — every /constitution route applies this, it doesn't re-author it">
The sequence that turns intent into a proposed issue. The command supplies its own input step;
this is everything after.
  <Step n="1">**Duplicate check** — run the query in Queries. On a match → the conflict gate below.</Step>
  <Step n="2">**Choose the mode** (B / C / R / S / D / T / X) and, from it, the form, the title shape, the labels, and the body template.</Step>
  <Step n="3">**Detect relationships** — an issue this one is blocked by, relates to, or supersedes.</Step>
  <Step n="4">**Conflict gate** — on a duplicate, contradiction, or overlap: **halt, present existing-vs-new with a recommendation, never act silently**.</Step>
  <Step n="5">**Propose** the full artifact (title + body + exact labels + any relationship lines). **Create only on authorization** (see Authorization); on OK, `issue_write` with `method: "create"`. Issue creation is high-level — the technical SPEC is authored later by `/specification`.</Step>
</Workflow>

<Workflow name="Duplicate check (mandatory before every creation)">
  <Step n="1">Run the query in Queries. Search **open and closed** — a closed issue for the same problem means either a regression (link it) or that the work already shipped.</Step>
  <Step n="2">Decide one of three actions when a match plausibly covers the same problem — **never silently create a duplicate**:

| Situation | Action |
| --- | --- |
| An existing issue already covers it fully, no new information | **Do nothing.** Don't create, don't comment. Report the existing issue to the user. |
| An existing issue covers it but you have **new evidence** (a fresh reproduction, a newly-identified file, a different transport, a compiler diagnostic) | **Propose a comment** on the existing issue headed `## Additional evidence (YYYY-MM-DD)`. Don't rewrite its body — keep the history visible. |
| An existing issue covers a related but **distinct** problem (different root cause / different fix path) | **Propose a new issue** with a `Related: #N` line, and explain why it isn't a duplicate. |
| A **closed** issue covers the same symptom | It is a **regression**. Propose a new issue linking back (`Related: #N — recurrence`), never reopen: the original's scope was fulfilled and verified. |
  </Step>
</Workflow>

<Workflow name="Closing the loop">
  <WhenFixShipped>
  <Step n="1">The issue closes **automatically** when a commit or PR carrying `Closes #N` merges to `main`. Prefer that over closing by hand — it records the linking commit on the timeline.</Step>
  <Step n="2">If it must be closed by hand, `issue_write` with `state: "closed"`, `state_reason: "completed"`, and a comment naming the merged commit.</Step>
  <Step n="3">Releases are **not** automatic here: they run via GitHub Actions `workflow_dispatch` (`.handbook/GIT_GUIDELINES.md`). A closed issue is not a released fix — if a consumer is waiting on the npm version, say so explicitly in the closing comment.</Step>
  </WhenFixShipped>

  <IfFixOpensDebt>
- Propose a Mode X issue with its closure condition, and the `// TODO(#<N>):` marker if you are
  already editing that file.
- Mention it in the closing comment of the original issue.
  </IfFixOpensDebt>
</Workflow>

<PostCreate>
After `issue_write` returns:
1. Capture the returned issue **number**.
2. Report it to the user as `#<N> — <title>` with its URL.
3. State the branch name the work will use, per `.handbook/GIT_GUIDELINES.md`:
   `feature/issue-<N>-<short-desc>` or `bugfix/issue-<N>-<short-desc>`.
4. If any follow-up call failed (a label rejected, a comment not posted), **report the failure**
   rather than the issue number alone. A created issue with a failed label is a partial result,
   not a done one.
</PostCreate>

<Queries>
**Duplicate check (mandatory before every creation)** — `search_issues`, `owner`/`repo` from
CachedFacts:

```
<keyword 1> <keyword 2> in:title,body
```

Run it twice: once unscoped by state (catches shipped fixes and regressions), once with
`is:open` when you need only the live backlog. For a bug carrying an exact diagnostic string,
search that string verbatim (`TS2589`) — it is the highest-signal keyword available.

**Live backlog by type:**

```
is:open label:bug
is:open label:enhancement
is:open label:chore
```

**Unassessed backlog** (everything a maintainer has not looked at):

```
is:open label:triage
```
</Queries>

<PreCreateChecklist>
- [ ] Certainty bar passed (CertaintyBar).
- [ ] Mode B: diagnosis complete (`bug-diagnosis` skill), reproduction attempted, outcome recorded verbatim in `Steps to Reproduce`.
- [ ] The problem applies to current `main` (deprecation check).
- [ ] Mode chosen, and with it the form, title shape, labels, and body template.
- [ ] Title follows the mode's rule (bracket prefix for a form-backed mode; Conventional-Commits subject for Mode T).
- [ ] Body follows the mode's template, with the form's section headers, in the form's order.
- [ ] Reporter-only fields dropped, not answered with invented values (ReporterOnlyFields).
- [ ] Every `file:line` came from a `codegraph_*` or `Read` call run **this session**.
- [ ] Labels: exactly one type label; every label confirmed to exist; no `released on @rc`; no invented `debt`/`priority: low`.
- [ ] Duplicate check ran, open **and** closed, with no unaddressed match.
- [ ] The full title + body + label list was shown to the user and they authorized **this** batch.
</PreCreateChecklist>

<OutOfScope>
- **Questions and usage help** → GitHub Discussions, per `.github/ISSUE_TEMPLATE/config.yml`. Not an issue.
- **Critical vulnerabilities** → private disclosure. Never a public issue (Mode S).
- **A design decision the project deliberately made** (the system is supposed to work that way) → document it in `README.md` or the relevant `.handbook/` file and close any would-be debt issue as `not_planned`.
- **Release mechanics** → they are automated by semantic-release; an issue about a version number that semantic-release owns is usually a `.releaserc.js` problem, not an issue.
</OutOfScope>

<Examples>

  <Example name="Title carries the exact diagnostic" kind="do">

```
[Bug]: Type instantiation is excessively deep and possibly infinite
```

The verbatim compiler message. Any consumer hitting `TS2589` searches that exact string and lands
here — which is the entire point of a bug title.
  </Example>

  <Example name="Title prescribes a fix before diagnosis" kind="dont">

```
[Bug]: Simplify the paramsSchema generic to avoid deep instantiation
```

Names a fix (`simplify the generic`) before the root cause is proven, and drops the searchable
diagnostic. State the failure; let the diagnosis place the fix.
  </Example>

  <Example name="Root cause grounded in evidence" kind="do">

```markdown
## Root cause

`ToolParamsRawShape` (`src/mcp.types.ts:41`, verified via codegraph) resolves through the SDK's
recursive `ZodRawShape` conditional, so `tsc` exceeds its instantiation depth when a
`paramsSchema` nests objects more than four levels deep. Reproduced by the four-level fixture in
`src/decorators/tool.decorator.spec.ts`. [Verified]
```

Every claim has a source: a `codegraph`-verified `file:line` and a reproduction that fails.
  </Example>

  <Example name="Root cause invented to fill the section" kind="dont">

```markdown
## Root cause

Probably the Zod generic is too complex and TypeScript gives up. It would make sense that the SDK
types are the issue.
```

`Probably` / `It would make sense` with no cited file and no reproduction. That is `[Inference]` —
defer creation, or mark the section `[Unverified]` under the explicit placeholder rule. Never ship
it as a root cause.
  </Example>

  <Example name="Closure condition is mechanically checkable" kind="do">

```markdown
## Closure condition

`pnpm typecheck` passes with `"typescript": "^6"` in `package.json`, `pnpm knip` reports no new
unused exports, and `grep -rn "@ts-expect-error" src/` returns the same 0 matches it does today.
```

Three triggers anyone can run. The issue has an observable done.
  </Example>

  <Example name="Closure condition that never fires" kind="dont">

```markdown
## Closure condition

Migrate to TypeScript 6 when the ecosystem has caught up and we have bandwidth.
```

"when the ecosystem has caught up" is not a trigger — nothing ever flips this closed, so it lives
forever. A debt item without a checkable condition is the status quo.
  </Example>

</Examples>

<Pitfalls>
  <Pitfall>Overwriting an issue body with `issue_write` without reading it first — `update` replaces wholesale and silently deletes the reporter's words. Always `issue_read` → merge → write (BodyUpdateMechanic).</Pitfall>
  <Pitfall>Echoing a read body straight back into an update without unescaping `&#34;` / `&#39;` / `&gt;` / `&amp;`. The read path adds them; writing them back corrupts the reporter's text on a public issue (BodyUpdateMechanic, Trap 1).</Pitfall>
  <Pitfall>Using an HTML comment as a sentinel. `issue_read` strips comments, so the next run cannot find its own marker and appends a duplicate (BodyUpdateMechanic, Trap 2).</Pitfall>
  <Pitfall>Putting the technical SPEC — or a summary of it, or a pointer to it — into an issue body. It lives in `.project/tasks/issue-&lt;N&gt;/spec.md`; the issue is read, never written.</Pitfall>
  <Pitfall>Updating an issue body at all. Nothing in this pipeline does; if you are reaching for it, re-read what stage you are in.</Pitfall>
  <Pitfall>Running `/security-review` from `/specification`. There is no diff yet; it reviews unrelated uncommitted work and reports irrelevant findings (ConsultAxes → SecurityAxisByStage).</Pitfall>
  <Pitfall>Inventing a label. `debt`, `priority: low`, `wontfix`, `good first issue` — confirm with `get_label` or leave it off; creating one is a repository mutation.</Pitfall>
  <Pitfall>Setting `released on @rc` by hand — it belongs to semantic-release.</Pitfall>
  <Pitfall>Answering reporter-only form fields (Prerequisites, Code of Conduct, Package Version) with invented values on a maintainer-authored issue.</Pitfall>
  <Pitfall>Putting a time estimate in `Estimated Effort` — `CLAUDE.md` prohibits estimates outright. State scope.</Pitfall>
  <Pitfall>Creating an issue without diagnosis ("investigate X" / "TBD"). Diagnose first.</Pitfall>
  <Pitfall>Treating a public issue as a scratchpad — every `#N` mention writes to that issue's timeline.</Pitfall>
  <Pitfall>Drafting a public issue for a critical vulnerability instead of routing to private disclosure.</Pitfall>
  <Pitfall>Bundling two deliverables into one issue. One issue = one unit of work; two means ask.</Pitfall>
  <Pitfall>Reopening a closed issue for a recurrence — open a new one linking back.</Pitfall>
  <Pitfall>Reporting an issue as closed-and-fixed when the release has not been dispatched — closing ≠ published to npm.</Pitfall>
  <Pitfall>Creating or commenting autonomously without explicit authorization for that exact batch.</Pitfall>
</Pitfalls>

<References>
  <Ref skill="bug-diagnosis" reason="Diagnosis precedes the issue; the certainty bar inherits its reproduction outcome states and the deprecation check." />
  <Ref skill="spec-driven" reason="The SPEC's content and the closure-condition discipline this skill shares — the SPEC is a workspace file, never issue content." />
  <Ref skill="task-workspace" reason="Where the SPEC, plan, QA plan, and verification record actually live — and the rule for what must stay in the public issue rather than on local disk." />
  <Ref doc="github-issues skill: templates/bug.md" reason="Mode B body — mirrors bug_report.yml's section order." />
  <Ref doc="github-issues skill: templates/feature.md" reason="Mode C body — mirrors feature_request.yml; Usage Example is the API proposal." />
  <Ref doc="github-issues skill: templates/refactor.md" reason="Mode R body — mirrors refactoring.yml; no public-API change by definition." />
  <Ref doc="github-issues skill: templates/security.md" reason="Mode S body — mirrors security.yml; critical issues route to private disclosure instead." />
  <Ref doc="github-issues skill: templates/task.md" reason="Mode T / Mode X body — the shape no .github form covers." />
  <Ref doc=".handbook/GIT_GUIDELINES.md" reason="Branch naming from the issue number, Conventional Commits types, and the manual release dispatch." />
  <Ref doc="CLAUDE.md" reason="The non-negotiables this skill enforces: no autonomous git, no time estimates, evidence-labelled claims." />
</References>
