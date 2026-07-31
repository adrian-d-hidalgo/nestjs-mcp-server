<!--
## Technical SPEC — written to .project/tasks/issue-<N>/spec.md by /specification, via the
specifier agent. This file is the SOURCE OF TRUTH for the technical analysis.

The GitHub issue carries the REQUEST layer (problem, expected behaviour, acceptance criteria,
usage example) or, for a bug, the report + reproduction + the debugger's RCA. The issue is READ
and never modified — nothing from this SPEC is written back to it. This SPEC REFERENCES the
request layer and adds only the TECH layer; it never restates it. In particular, do NOT copy the
issue's acceptance criteria here — they would drift, and the issue's are the ones that count.

This is a skeleton. The how/why of writing a SPEC (evidence discipline, confidence tags,
closure standard, the SDK-types check) lives in the spec-driven skill, not here. High level:
DECISIONS and CONTRACTS, not a development plan. No file-by-file step list — that is /develop's
job, produced in its conversation and never persisted. Fill every section; empty ones get `_n/a_` + the reason
(except Notes, omitted when empty). Confidence is inline per claim — [Verified] / [Inference] /
[Unverified] on the `file:line` it rests on — never a section of its own.

.project/ is gitignored: there is no reviewer and no diff here. That does not lower the
evidence bar — it raises it. Delete this comment block when writing the real file.
-->

# Technical SPEC — #<N> <issue title>

**Issue:** https://github.com/adrian-d-hidalgo/nestjs-mcp-server/issues/<N>
**Authored:** <YYYY-MM-DD>
**Status:** ready

<!--
The Status line is MANDATORY and machine-read by /develop's preconditions. Exactly two forms:

  **Status:** ready
  **Status:** blocked: <the one question that must be answered before implementation>

It exists because prose cannot be greped for readiness: a refine log legitimately contains the
words "not ready", "blocking" and "open decision" while describing their REMOVAL, and an earlier
version of the gate matched nine such false positives on a fully-unblocked SPEC. Keep this field
accurate — it is the only thing /develop reads to decide whether to plan.
-->

**Scope:** which surfaces this touches, by real path — one line.
e.g. `src/decorators, src/services · public API: yes · examples: yes`

### Current state
How the relevant code behaves today, at module level. A precise `file:line` only where a
decision hinges on that exact spot, and only from a `Read` or `codegraph_*` call run this
session. Any technical "why it fails" insight lives here; a bug's full RCA stays in the issue
above and is referenced, not repeated.

### Proposed approach
The work as the decisions that constrain it: what changes in behaviour, which module owns it,
what stays untouched. Open decisions listed as open. No file-line dumps, no step list.

### Public API impact
What changes in the surface exported from `src/index.ts` — decorators, `McpModule.forRoot` /
`forRootAsync` options, exported types and interfaces, handler signatures, transport options.
One line per changed export, tagged NEW / MODIFIED / REMOVED.

`_n/a_` **only** when the emitted `.d.ts` would be byte-identical — and that is a claim to
prove (`pnpm build`, then diff the declarations), not to assume.

#### <NEW|MODIFIED|REMOVED> · `<exported symbol>`
- what changes · the shape before and after · what a consumer must edit, if anything

### SemVer impact
The version bump this produces, the Conventional Commits type that triggers it, and the
reasoning. `/develop` reads this section to write the commit message, so it is a decision made
here, not deferred to the diff.

Per `.handbook/GIT_GUIDELINES.md` and `.releaserc.js`: `feat:` → MINOR · `feat!:` /
`BREAKING CHANGE:` → MAJOR · `fix:` / `perf:` → PATCH · `build(deps):` / `chore(deps):` →
PATCH · `docs:` `style:` `refactor:` `test:` `chore:` → no release.

Anything removed, renamed, or narrowed in the exported surface is MAJOR, however small it
feels. State the `BREAKING CHANGE:` footer text verbatim when it applies.

### Type contracts
The `@modelcontextprotocol/sdk` types this work reuses, with their import paths — the
SDK-types-first non-negotiable from `CLAUDE.md` discharged in writing.

For any type this work introduces: which SDK types were checked, why each fails to fit, and
why a new one is warranted. "I didn't find one" is not "none exists" — check with `context7`
for current SDK docs and codegraph for what this repository already imports.

`_n/a_` when the work introduces and reuses no type at all.

### Closure condition
The technical end-state AND its verifiable trigger — beyond the issue's functional acceptance
criteria, not a restatement of them. State any added constraint or invariant the AC does not
cover, then the checkable trigger that proves it holds: a named spec passing, a `grep`
returning 0, `pnpm knip` clean, an `EXAMPLE=<name> pnpm start:example` that starts and serves.

### Dependencies
Work that ALREADY EXISTS which this needs — a merged prerequisite, an upstream SDK release, an
open issue that must land first (`Blocked by #N`). Never a list of steps in this SPEC's own
work. `_n/a_` if none.

### Risks
What breaks if this is implemented wrong; the regression surface; which specs cover the touched
code today and which do not; the mitigation. Note explicitly if the coverage thresholds in
`package.json` are at risk.

### Consults
The axes that fired for THIS issue and the finding of each — per the `github-issues` skill's
`<ConsultAxes>`. Every axis you decide NOT to fire is recorded here **with its reason**;
collapsing is not bypassing.

| Axis | Fired | Finding / reason for not firing |
| --- | --- | --- |
| Architecture | yes/no | |
| Security | yes/no | |

### Alternatives considered
The technical paths not taken and why — the core reasoning this SPEC preserves. When a consult
finding killed a path, cross-reference it.

End with **Documentation actually read**: the upstream doc pages consulted, by path, and the
relevant ones you did **not** read. When the work wraps or reimplements something
`@modelcontextprotocol/sdk` already does, this list is what lets a reviewer tell whether the design
was informed by upstream guidance or only by upstream `.d.ts` files — those answer different
questions, and mistaking one for the other produces a confidently wrong design. An unread source
named is recoverable; an unread source unmentioned reads as considered.

### Notes
Anything else load-bearing, including what would raise a low-confidence call. Optional; omitted
when empty.

<!--
Reminder before finishing: this file is the only place the analysis lives. Nothing above is
copied to the GitHub issue.

That has one consequence worth acting on: `.project/` is gitignored, so if a decision here is
something a contributor or consumer genuinely needs — the change is breaking, the issue is
blocked on an unanswered question, a stated requirement turns out to be unbuildable — say so in
the report so the USER can comment on the issue. A decision that exists only here reaches
nobody.
-->
