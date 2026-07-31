---
name: spec-driven
description: "Spec-driven development protocol for @nestjs-mcp/server: how to analyze and write a technical SPEC into the task workspace before implementation, including the Public API / SemVer impact axes a published library requires. Load when producing or refining a SPEC for an accepted issue, or when deciding spec-first vs issue-first."
---

<Purpose>
Install the reflex that technical analysis lands in a single auditable SPEC instead of being
scattered across chat history. The SPEC **is a file** — `.project/tasks/issue-<N>/spec.md`,
authored by `/specification` via the `specifier` agent after the issue is accepted. It lives on
disk, where it is greppable, readable without a network call, and free to be as long as the analysis
needs.

**The GitHub issue is never modified.** No SPEC, no summary, no pointer, no managed block. The issue
is the requirement as its author wrote it; the SPEC is the analysis of how to satisfy it. Two
artifacts with two owners and no synchronisation — which is precisely why they cannot drift out of
agreement with each other.

The input is the accepted issue and its acceptance criteria; the OUTPUT is `spec.md` (plus
`test-plan.md`, whose shape the `task-workspace` skill owns). This is the analysis layer; it never
edits code. It sits between issue creation (`/constitution`) and implementation (`/develop`). GitHub
owns the issue's status and lifecycle; the `task-workspace` skill owns where the files live; this
skill owns what goes in the SPEC.

This project is a **published npm library**, which adds two axes no application-side SPEC needs:
what changes in the surface exported from `src/index.ts`, and what version bump that implies.
Those are `Public API impact` and `SemVer impact`, and they are the sections most likely to be
skipped and most expensive to get wrong.
</Purpose>

<WhenToUse>
  <Trigger>Authoring the technical SPEC for an accepted GitHub issue (the `/specification` flow).</Trigger>
  <Trigger>Work requires technical analysis before implementation and the symptom is not yet a clear, certainty-bar-passable bug.</Trigger>
  <Trigger>Refining an existing SPEC on an issue — "the reproduction landed, update Current state", "we chose the other approach, update it".</Trigger>
  <Trigger>Deciding spec-first vs issue-first for a new work item.</Trigger>
  <Trigger>Determining whether a change is `feat` / `feat!` / `fix` / no-release before it is built.</Trigger>
</WhenToUse>

<DecisionTable name="Spec-first vs issue-first">
The user decides whether a given input warrants a SPEC. The routing for new work:

| Input shape | Route |
| --- | --- |
| A consumer-visible defect | Open the issue FIRST (`github-issues` skill, Mode B via `/debug`); the SPEC then captures the supporting analysis in the workspace. |
| The symptom is a clear, certainty-bar-passable bug with an obvious one-line fix | Skip the SPEC — go straight to the issue, then `/develop`. |
| An accepted issue needs technical analysis before implementation | `/specification <#N>` — the `specifier` authors `spec.md` into the task workspace. |
| Root cause not obvious from a single Read pass | Bug-shaped SPEC — the `debugger` consult is the default (`bug-diagnosis` skill). |
| Anything touching the exported surface | **Always** a SPEC. `Public API impact` and `SemVer impact` are not decisions to make mid-implementation. |

The issue owns execution (state + labels) and the public contract; `spec.md` owns the technical
analysis. Two artifacts with two audiences — not one duplicated in two places.
</DecisionTable>

<Workflow name="Authoring the SPEC">
Producing a SPEC does not edit code and does not touch GitHub — it writes structured analysis to
disk. Two actions cover the lifecycle.

  <Action name="Author">
Input: the accepted GitHub issue and its acceptance criteria. The `specifier` analyzes the code
and fills the SPEC structure (the section list below).

Output: `.project/tasks/issue-<N>/spec.md`. See `<WriteMechanic>`.
  </Action>

  <Action name="Refine">
Apply an instruction to an existing SPEC ("the reproduction landed, add the failing spec",
"the security consult found X, update Risks").

Output: the same `spec.md`, updated in place. Nothing else changes — there is no second copy
anywhere to keep in step, which is the main practical benefit of the SPEC being a file rather than
issue content.

Refining MUST NOT silently drop existing content — additions go in their natural section; revisions
cite what changed and why. `.project/` is gitignored, so there is no `git diff` to recover from: a
silent deletion here is unrecoverable.

**A correction must be propagated to every section that repeated the claim.** `grep` the corrected
assertion across the whole file before finishing. A SPEC's sections deliberately cross-reference each
other — `Current state` feeds `Consults`, `Consults` feeds `Alternatives considered` — so a claim
that was wrong in one place is usually wrong in two or three.

Half a correction is **worse than none**: the original was consistently wrong and a reader could at
least act on it, whereas a SPEC whose `Current state` and `Consults` disagree gives a reader no way to
tell which sentence is current. This is not hypothetical — the first refine performed under this skill
corrected `Current state` and left `Consults` asserting the opposite, and it took a later `/develop`
run reading the file to notice.
  </Action>
</Workflow>

<WriteMechanic reason="one destination, and one failure mode worth naming">
The SPEC is written to **`.project/tasks/issue-<N>/spec.md`** and nowhere else.

Create `.project/tasks/issue-<N>/` lazily: only when there is something real to write. Write the
full SPEC per `templates/SPEC.md`.

On a re-run, **`Read` the existing file first** and refine it — never blind-overwrite. `.project/`
is gitignored: there is no history and no `git diff` to recover from, so a section dropped by an
overwrite is simply gone. This is the one failure mode here, and it is silent.

**The GitHub issue is not a destination.** Not the SPEC, not a summary, not a pointer, not a managed
block. `/specification` holds no GitHub write tool, so this is structural rather than advisory.

Two consequences worth being explicit about, because they are the cost of the design:

- **The SPEC does not travel.** It is not in a clone, not in CI, not visible to a contributor. For a
  solo maintainer that is the right trade; it also means anything a contributor genuinely must know —
  a breaking change, a blocked design question — has to be said in the issue **by the user**, not
  silently left on disk. Surface it in your report and let them decide.
- **There is nothing to keep in sync.** No second copy, no pointer that can go stale, no drift
  between what the issue claims and what the SPEC says. That is the benefit paid for by the cost
  above.
</WriteMechanic>

<Patterns>

  <Pattern name="Specifier-first — four mandatory steps">
Authoring a SPEC delegates to the `specifier` agent. Before writing any section, it runs these
four steps over the accepted issue.

```
1. Read the issue end-to-end (issue_read, method "get" — plus "get_comments",
   where the real constraints often live). Do not paraphrase from memory;
   read its full acceptance criteria.
2. Identify the affected surfaces by real path: src/decorators, src/services,
   src/transports, src/interfaces, src/types, test/, examples/.
3. Inspect the actual code (codegraph_* + Read). No memory-based claims.
4. Resolve real names. Every file / function / symbol cited must exist in the
   repository or be explicitly flagged "to create".
```

Every claim in the SPEC cites a source. No hit in codegraph AND no hit in grep = the symbol does
not exist.
  </Pattern>

  <Pattern name="Upstream guidance, not just upstream types">
Reading `node_modules/@modelcontextprotocol/sdk` tells you what the SDK **can** do. Reading its docs
tells you what it **recommends**. Those are different questions, and a SPEC that answers only the
first can be accurate in every `file:line` and still specify a design that fights a pattern the SDK
documents.

So: when the issue cites upstream documentation, or the work wraps or reimplements a capability the
SDK already has, read the SDK's guidance on **that pattern** — the areas the work actually touches
(serving and transport topology, sessions and state, notifications, auth), queried separately rather
than assumed covered by whichever page sat nearest the symbol you started from.

`Alternatives considered` ends with the doc pages read **and the relevant ones not read**. An unread
source named is recoverable; an unread source unmentioned reads as considered.
  </Pattern>

  <Pattern name="SDK types before new types — a blocking check, not a preference">
`CLAUDE.md` makes this non-negotiable: *"This library wraps `@modelcontextprotocol/sdk`. Reuse SDK
types (`CallToolResult`, `RequestHandlerExtra`, etc.) from `@modelcontextprotocol/sdk/types`."*

The SPEC's `Type contracts` section is where that check is discharged. For every type the work
needs:

- Name the SDK type being reused, with its import path.
- If no SDK type fits, **say which ones you checked and why each fails** before proposing a new
  one. "I didn't find one" is not the same as "none exists" — use `context7` for the SDK's current
  docs and codegraph for what this repository already imports.
- A new type that duplicates an SDK type under a different name is a defect the SPEC is supposed
  to catch, and the cheapest place to catch it.
  </Pattern>

  <Pattern name="Consults by axis">
After the four steps, the specifier decides consults by axis. The axis triggers are owned by the
`github-issues` skill's `<ConsultAxes>` — the single source; do not restate them here. At SPEC
time the specifier runs **Architecture + Security**, plus one spec-specific addition:

| Axis | Consult |
| --- | --- |
| Architecture (per ConsultAxes triggers) | the specifier's own analysis, recorded in `Consults` |
| Security (per ConsultAxes triggers) | the built-in `/security-review` skill |
| Diagnosis (root cause not obvious from a single Read pass) | `debugger` agent — default for bug-shaped SPECs (`bug-diagnosis` skill) |

The Diagnosis row is a CONSULT, not a SPEC section: the debugger's RCA lands in the issue's
`Root cause` section above the SPEC, and the SPEC references it from `Current state` — it is never
a `## Diagnosis` section restating the RCA. The Quality axis runs later, in `/develop`, on the
actual diff.

**Record every axis you decide NOT to fire, with its reason.** Collapsing is not bypassing.
  </Pattern>

  <Pattern name="Evidence discipline — order matters">
`Proposed approach` is written AFTER `Current state`. Writing the approach first constrains the
analysis to justify a decision already made.

Every `file:line` cited must come from a `Read` or a `codegraph_*` call **actually run during this
SPEC session** — never from memory, never from a previous conversation. Confidence rides inline on
each claim as `[Verified]` / `[Inference]` / `[Unverified]`, not as a section. What would raise a
low-confidence call goes in `Notes` or inline beside the uncertain claim.

This is the same bar `CLAUDE.md` sets: *"Compiling is not executing; types verify code, not
behavior. A fix grounded in `[Inference]` is not done."*
  </Pattern>

  <Pattern name="Authorization scope — nothing here is a public mutation">
The SPEC workflow writes exactly two things, both local and both gitignored: `spec.md` and
`test-plan.md` in the task workspace. Code changes require their own approval flow (`/develop`, or a
direct user instruction). A SPEC is analysis; execution is separate.

**There is no public mutation to gate**, because the issue is never written. The files are written,
their paths and headline decisions reported (`Public API impact`, `SemVer impact`, any blocking open
question), and the user reads them in the editor — which is the only practical way to review a
multi-hundred-line artifact.

An earlier version of this skill demanded the user approve both files "in full, every section" in
the conversation before anything was written. That is unreadable, so it would have been skipped or
rubber-stamped — a gate nobody can use is worse than no gate, because it launders an unreviewed
write as an approved one. Report the decisions; let the file be read where files are read.

What still needs an explicit OK: **anything that leaves the workspace.** If a finding should be
posted to the issue, the user posts it.
  </Pattern>

</Patterns>

<Template name="The required sections">
The SPEC opens with a one-line **Scope** field, then carries these sections, IN THIS ORDER. Empty
sections are marked `_n/a_` **with the reason** — never omitted (except `Notes`, omitted when
empty).

```
Scope · Current state · Proposed approach · Public API impact · SemVer impact ·
Type contracts · Closure condition · Dependencies · Risks · Consults ·
Alternatives considered · Notes
```

Three of these are specific to a published library and replace the application-side sections a
service SPEC would carry:

- **`Public API impact`** — what changes in the surface exported from `src/index.ts`: decorators,
  module options (`McpModule.forRoot` / `forRootAsync`), exported types and interfaces, handler
  signatures, transport options. `_n/a_` only when the emitted `.d.ts` would be byte-identical —
  and if you assert that, `pnpm build` plus a diff of the emitted declarations is how it gets
  proven, not assumed.
- **`SemVer impact`** — the resulting version bump and the commit type that produces it, with the
  reasoning. This is what `/develop` later reads to suggest the commit message, so a wrong call
  here ships a wrong version to npm. Per `.handbook/GIT_GUIDELINES.md` and `.releaserc.js`:

  | Change | Commit type | Bump |
  | --- | --- | --- |
  | New capability, additive to the surface | `feat:` | MINOR |
  | Anything removed, narrowed, or renamed in the surface | `feat!:` (or a `BREAKING CHANGE:` footer) | MAJOR |
  | Defect fix, surface unchanged | `fix:` | PATCH |
  | Performance improvement | `perf:` | PATCH |
  | Dependency bump | `build(deps):` / `chore(deps):` | PATCH (repo-specific rule, `.releaserc.js:16-19`) |
  | Docs, style, refactor, tests, other chores | `docs:` `style:` `refactor:` `test:` `chore:` | **no release** |

  A change a consumer must edit their code for is MAJOR, even when it "feels small" — a narrowed
  parameter type and a renamed export both qualify.
- **`Type contracts`** — the SDK types reused, with import paths, and the justification for any
  new type (see the SDK-types pattern above). `_n/a_` when the work introduces no type at all.

`Closure condition` carries the technical end-state AND its verifiable trigger — a passing spec, a
`grep` returning 0, an example under `examples/` that runs. The functional acceptance criteria live
on the **issue**; this is the technical closure the AC does not cover.

The SPEC is the TECH layer. It never restates what the issue, a bug's reproduction and RCA,
`CLAUDE.md`, or `.handbook/` already says — those are referenced by link or issue number, not
duplicated. That matters more now that the SPEC is a separate file: a duplicated acceptance
criterion in `spec.md` will drift from the issue's, and the issue is the one that is right.

The fillable skeleton with each section's instructions lives at `templates/SPEC.md`. Where the file
sits and what else shares its directory is owned by the `task-workspace` skill.
</Template>

<Conventions>

- The user decides whether a given input warrants a SPEC; this protocol defines what the output
  looks like once they do.
- **Every SPEC must have a closure condition** — the same standard `github-issues` applies to
  Mode X debt. Without a verifiable trigger (a spec passing, a `grep` returning 0, an example
  running), the work has no observable done.
- The SPEC is a file in the task workspace and follows the project's written conventions: English,
  `##` headers, code verbatim, repo-relative paths, no time estimates.
- **A local file is not a lower standard of truth than a public one.** Being gitignored does not
  relax the evidence bar — if anything it raises it, because there is no reviewer and no diff.
- The SPEC states **decisions and contracts**, not a development plan. No file-by-file step list —
  that is `/develop`'s job, produced in its own conversation and deliberately never persisted.

</Conventions>

<Examples>

  <Example name="Current state — cited from a real read" kind="do">

```md
## Current state
`ToolParamsRawShape` is declared at `src/mcp.types.ts:41` and re-exported from
`src/index.ts:12` [Verified, codegraph_search]. `@Tool` passes it straight to the SDK's
`registerTool` generic (`src/decorators/tool.decorator.ts:58`), so a consumer's
`paramsSchema` type flows unmodified into the SDK's conditional resolution.
```

Every name and path traces to a `codegraph_search` or `Read` run this session, and the
`file:line` points at the exact line the claim rests on.
  </Example>

  <Example name="Current state — memory-based claim" kind="dont">

```md
## Current state
The tool decorator probably passes the schema through to the SDK somewhere in the
decorators folder — I recall this pattern from the resources decorator.
```

No `file:line`, "probably / I recall" — a memory claim. No hit in codegraph AND no hit in grep
means the symbol does not exist; this fails the evidence bar outright.
  </Example>

  <Example name="SemVer impact — the call is made and justified" kind="do">

```md
## SemVer impact
**MAJOR — `feat!:`.** `ToolParamsRawShape` is currently exported from `src/index.ts:12`
and this work replaces it with the SDK's `ZodRawShapeCompat`. Any consumer importing the
old name breaks at compile time, so the removal is breaking regardless of runtime
behaviour. Commit footer carries `BREAKING CHANGE: ToolParamsRawShape is replaced by
ZodRawShapeCompat from @modelcontextprotocol/sdk`.
```

Names the bump, the commit type, the exact export that disappears, and the consumer-visible
consequence. `/develop` can now produce the commit message without re-deciding anything.
  </Example>

  <Example name="SemVer impact — deferred to implementation" kind="dont">

```md
## SemVer impact
Probably a minor bump, we can decide when we see the final diff.
```

The bump is a design decision, not an outcome of the diff. Deferring it means the call gets made
under time pressure at commit time, which is how a breaking change ships as a MINOR.
  </Example>

  <Example name="Closure condition — mechanically checkable" kind="do">

```md
## Closure condition
`pnpm test -- src/decorators/tool.decorator.spec.ts` passes with the four-level nesting
fixture added, `pnpm typecheck` is clean, and `EXAMPLE=tools pnpm start:example` starts
and lists the tool over stdio.
```

Three triggers anyone can run, one of which exercises the real transport rather than the types.
  </Example>

  <Example name="Closure condition — no verifiable trigger" kind="dont">

```md
## Closure condition
The deep-instantiation problem no longer occurs and the types feel cleaner.
```

"no longer occurs" is not observable without naming how it is checked, and "feel cleaner" is not
checkable at all.
  </Example>

</Examples>

<Pitfalls>
  <Pitfall>Memory-cited claims — every `file:line` must come from a `Read` or `codegraph_*` call actually run during this SPEC session.</Pitfall>
  <Pitfall>Solutioning before evidence — `Proposed approach` is written AFTER `Current state`.</Pitfall>
  <Pitfall>Marking `Public API impact` as `_n/a_` without proving it — if the emitted `.d.ts` changes, it is not `_n/a_`.</Pitfall>
  <Pitfall>Deferring the `SemVer impact` call to implementation time. That is how a breaking change ships as MINOR.</Pitfall>
  <Pitfall>Defining a new type without first naming the SDK types checked and why each fails — a `CLAUDE.md` non-negotiable.</Pitfall>
  <Pitfall>Reading the installed SDK source thoroughly and its documentation barely, then declaring this library's architecture in conflict with a pattern the SDK actually recommends. Precise `file:line` citations do not rescue a design premised on unread guidance.</Pitfall>
  <Pitfall>Omitting which doc pages were read. Silence about a source is indistinguishable from having considered it.</Pitfall>
  <Pitfall>Restating the issue's report layer — the SPEC never repeats the bug's reproduction, the debugger's RCA, or the functional AC. It references them and adds only the tech layer.</Pitfall>
  <Pitfall>Empty sections without `_n/a_` + a reason. Silently dropping a section breaks the audit (`Notes` is the only exception).</Pitfall>
  <Pitfall>Scope drift mid-SPEC — if the scope grows beyond the issue's AC, stop and ask whether to split. Don't write a SPEC covering more than its issue.</Pitfall>
  <Pitfall>A SPEC without a closure condition — the work then has no observable done.</Pitfall>
  <Pitfall>Writing either artifact without explicit authorization, or updating the issue without reading its current body first.</Pitfall>
  <Pitfall>Blind-overwriting `spec.md` on a re-run instead of reading and refining it. It is gitignored — there is no diff and no history to recover the dropped section from.</Pitfall>
  <Pitfall>Writing the SPEC — or a summary, or a pointer to it — into the issue. The issue is read-only input; the SPEC is a workspace file.</Pitfall>
  <Pitfall>Leaving a decision a contributor needs (a breaking change, a blocked design question) only in `spec.md`. It is gitignored — surface it and let the user post it.</Pitfall>
  <Pitfall>Recording a load-bearing decision only in `spec.md`. `.project/` is gitignored — for anyone without your checkout, it is not there.</Pitfall>
  <Pitfall>Duplicating the issue's acceptance criteria into `spec.md`. They will drift, and the issue's are the ones that count.</Pitfall>
  <Pitfall>Refine silently dropping existing content — additions go in their natural section; revisions cite what changed and why.</Pitfall>
  <Pitfall>Correcting a claim in one section and leaving it standing in another. `grep` the corrected assertion across the whole file — a self-contradicting SPEC is worse than a consistently wrong one, because a reader cannot tell which sentence is current.</Pitfall>
</Pitfalls>

<References>
  <Ref doc="spec-driven skill: templates/SPEC.md" reason="The fillable SPEC skeleton — the section structure the specifier fills." />
  <Ref skill="task-workspace" reason="Where spec.md lives, what else shares its directory, and which stage owns which file." />
  <Ref skill="github-issues" reason="The body-update mechanic and its markers, the authorization contract for the issue write, the consult axes, and the closure-condition discipline this skill shares." />
  <Ref skill="bug-diagnosis" reason="Default debugger consult for bug-shaped SPECs when root cause is not obvious from a single Read pass." />
  <Ref doc="CLAUDE.md" reason="SDK-types-first non-negotiable, the honesty bar on [Unverified]/[Inference], and the five-phase quality gate the closure condition is checked against." />
  <Ref doc=".handbook/GIT_GUIDELINES.md" reason="Conventional Commits types and the version bump each produces — the input to SemVer impact." />
</References>
