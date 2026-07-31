---
name: task-workspace
description: "The local task workspace at .project/tasks/issue-<N>/ — its layout, lifecycle, which command writes which file, and the templates for spec.md, test-plan.md, verification.md and notes.md. Load when authoring a SPEC, executing development, or looking for what a task already decided, tried, or proved."
---

<Purpose>
Give every issue under active work a **durable local home** for the artifacts that outlive a
session: what must be built, how it will be verified, what the verification actually found, and
what was tried and ruled out.

This skill owns **where things live and who writes them**. It does not own the SPEC's content —
that belongs to the `spec-driven` skill.

  <WhatIsDeliberatelyNotHere>
**The execution plan is not an artifact.** `/develop` produces a concrete, file-level plan for the
work in front of it, and that plan lives **in the conversation**. It is not written to disk.

That is a deliberate line, not an omission. `spec.md` and `test-plan.md` answer *what must be done*
and stay true across sessions. An execution plan answers *how, right now, against this working
tree* — it is stale the moment the code moves, and a stale plan on disk is worse than no plan,
because a later session reads it as current. The durable half of the pipeline is the specification
and the evidence; the plan is the ephemeral bridge between them.
  </WhatIsDeliberatelyNotHere>
</Purpose>

<WhenToUse>
  <Trigger>Authoring a SPEC or QA plan for an accepted issue (`/specification`) — the workspace is where they land.</Trigger>
  <Trigger>Executing development (`/develop`) — it reads the spec and QA plan from here and records the verification here.</Trigger>
  <Trigger>Picking work back up on an issue — read the workspace before re-deriving anything.</Trigger>
  <Trigger>Looking for what was already decided, tried, or ruled out on an issue.</Trigger>
  <Trigger>Deciding whether a piece of information belongs in the workspace or in the public issue.</Trigger>
</WhenToUse>

<Layout>
One directory per issue, keyed by the **GitHub issue number** — the identifier that already exists.
There is no second numbering scheme: the directory `issue-96/` and the issue `#96` can never drift
apart because they are the same number.

```
.project/
  tasks/
    README.md                  # what this folder is (committed nowhere — .project is gitignored)
    issue-96/
      spec.md                  # the technical SPEC       — written by /specification
      test-plan.md             # the QA / acceptance plan — written by /specification
      verification.md          # AC → evidence record     — written by /develop
      notes.md                 # findings, dead ends      — written by any stage, append-only
    issue-109/
      ...
```

Four files, and no execution plan among them — see `<WhatIsDeliberatelyNotHere>`.

**Create the directory lazily** — only when a stage actually has something to write. An empty
`issue-N/` directory is noise that implies work that never happened.

**Never create a file with only its template headings.** A `verification.md` full of unfilled
placeholders reads, to a later session, as work that was done and found nothing. If a stage has
nothing to record yet, it writes nothing.
</Layout>

<Ownership reason="each file has exactly one writing stage — shared ownership is how files rot">
| File | Written by | Read by | Purpose |
| --- | --- | --- | --- |
| `spec.md` | `/specification` (via the `specifier` agent) | `/develop`, the user | The technical analysis and the decisions: current state, approach, Public API impact, SemVer impact, type contracts, closure condition. **The source of truth for the SPEC.** |
| `test-plan.md` | `/specification` | `/develop` (executes it), the user | **QA / acceptance-level** verification — the protocol-level and consumer-facing checks, not the unit specs. See `<TestPlanScope>`. |
| `verification.md` | `/develop`, as evidence arrives | the user, a later session | Every acceptance criterion mapped to pass/fail **with the evidence that proves it**. |
| `notes.md` | any stage, append-only | every stage | Dead ends, discarded approaches, out-of-scope findings. Stops the next session re-investigating what was already ruled out. |

The split is by **shelf life**: `/specification` writes what stays true (the spec, the QA plan),
`/develop` writes what was found (the evidence, the notes). The execution plan sits between them
and is stale on contact with a changed working tree, so it stays in the conversation.

A stage never rewrites a file it does not own. `/develop` does not edit `spec.md` — if the SPEC is
wrong, that is a `/specification` refine, and going back is the correct move rather than bending
the work around a bad spec.
</Ownership>

<PublicVsLocal reason="the workspace is gitignored — what lives here is invisible to everyone else">
`.project/` is in `.gitignore`. Nothing here survives a clone, appears in CI, or is visible to a
contributor. That is deliberate — it keeps working artifacts out of a public repository's history —
but it draws a hard line about what may live here **only**:

| Information | Home | Why |
| --- | --- | --- |
| The problem, the acceptance criteria, the reproduction, the root cause | **The issue** | It is the contract with whoever consumes or contributes to the package. |
| The SemVer call, the closure condition, the approach | **The workspace** (`spec.md`) | The analysis is local. Nothing is written back to the issue — but see the note below, because this row is where the design's one real cost lands. |
| The full technical analysis, the plan, the evidence record, the dead ends | **The workspace** | Working detail. Noise in a public issue, valuable on disk. |
| Anything a consumer must eventually read | **The issue or the README** | If it only exists in `.project/`, it does not exist. |

**The failure this table prevents:** deciding something load-bearing — a breaking change, a dropped
acceptance criterion, a known limitation — and recording it only in the workspace. Nobody else can
ever see it.

**No command writes to the issue**, so this cannot be automated away. When a workspace decision has
an audience beyond you, the stage's job is to **say so in its report** so you can comment on the
issue yourself. Publishing out of a deliberately private workspace is the maintainer's call, not an
automatic side effect — but a decision nobody surfaces is a decision nobody has.

If these artifacts should one day be shared and versioned, the change is a single `!.project/tasks/`
exception in `.gitignore` — but that is a deliberate decision with consequences for a public repo,
not something a command does on its own.
</PublicVsLocal>

<TestPlanScope reason="test-plan.md is QA-level; it is NOT the unit specs, and conflating the two makes it worthless">
`test-plan.md` covers what a **QA pass** would exercise: the behaviour a real consumer and a real
MCP client observe. The unit and e2e specs are the developer's job and live in `src/` and `test/` —
they are named here only as the coverage floor the QA plan sits on top of.

The distinction, concretely:

| Not the QA plan (developer's, in code) | The QA plan (this file) |
| --- | --- |
| `tool.decorator.spec.ts` asserts the metadata key | The tool actually appears in `tools/list` in the MCP Inspector |
| A spec mocks the transport | The same scenario is run across stdio, SSE, and streamable HTTP |
| `concurrent-clients.e2e-spec.ts` passes | A second client connects while the first is mid-request and neither observes the other |
| The types compile | A consumer on the minimum supported NestJS version can still build |

**What a QA plan for this package covers:**

1. **Protocol-level behaviour** — `pnpm start:inspector` against the relevant example. What does a
   real MCP client see: the tool listed, the schema rendered, the result shaped correctly, the error
   surfaced usefully?
2. **The protocol-era matrix** — the same scenario under the modern era (`2026-07-28`: stateless,
   no handshake, no session) **and** the 2025 legacy fallback, whenever the change touches anything
   the HTTP transport carries. The two eras answer differently on purpose — the modern one returns
   405 to the retired session operations — so a change that works on one and breaks the other is
   the classic escape. `test/protocol-eras.e2e-spec.ts` is the existing harness.
3. **Consumer flows** — the affected `examples/` (`tools`, `guards`, `prompts`, `resources`,
   `mixed`, `for-root-async`, `dynamic`) actually start and serve, per `CLAUDE.md`.
4. **Compatibility** — the declared peer range still builds: the NestJS versions in `peerDependencies`
   and the Node version in `.nvmrc`. Relevant whenever types or module wiring move.
5. **Regression surface** — the adjacent flows to smoke-test. Which *other* decorator, guard scope,
   or transport shares the code being changed?
6. **Upgrade path** — for anything the SPEC called `feat!`: exactly what a consumer must edit, tried
   against a real example rather than asserted.

Each case states **how it is run** (the command), **what is observed**, and **what "pass" means**.
A case nobody can execute from the text is not a test case.
</TestPlanScope>

<Lifecycle>
  <Step n="1">**`/specification <#N>`** — creates `issue-<N>/` and writes `spec.md` and `test-plan.md`. It **reads** the GitHub issue and never writes to it; the two files are the entire output.</Step>
  <Step n="2">**`/develop <#N>` Phase 1** — reads `spec.md`, `test-plan.md`, and `notes.md`, verifies the current code state, and produces the concrete execution plan **in the conversation** for the user to approve. Nothing is written.</Step>
  <Step n="3">**`/develop <#N>` Phase 2** — executes, runs the quality gate and `test-plan.md`'s cases, and records every acceptance criterion in `verification.md` with its evidence. Appends to `notes.md` anything found and not built.</Step>
  <Step n="4">**Picking work back up** — read the workspace before re-deriving anything. `spec.md` says what was decided, `notes.md` says what was already ruled out, `verification.md` says what was already proven. Re-planning the execution is expected and cheap; re-deciding the SPEC or re-investigating a known dead end is the waste this prevents.</Step>
  <Step n="5">**Close** — when the issue closes, the workspace stays on disk. It costs nothing, it is not versioned, and it is the only record of why an approach was rejected. Do not delete it as cleanup.</Step>
</Lifecycle>

<Conventions>

- **English**, matching the rest of the project's written artifacts.
- **Evidence discipline is identical to the SPEC's**: every `file:line` comes from a `Read` or
  `codegraph_*` call run in the session that wrote it, and confidence rides inline as `[Verified]` /
  `[Inference]` / `[Unverified]`. A local file is not a lower standard of truth than a public one.
- **`notes.md` is append-only**, newest section last, each entry dated. Rewriting it destroys the
  reason it exists.
- **Never a time estimate** — a `CLAUDE.md` prohibition that applies here too.
- **Paths are repo-relative** (`src/decorators/tool.decorator.ts:58`), never absolute — the
  workspace is read by a future session whose working directory you cannot predict.

</Conventions>

<Pitfalls>
  <Pitfall>Writing a file with unfilled template placeholders. To a later session it reads as work that was done and found nothing.</Pitfall>
  <Pitfall>Creating `issue-<N>/` before any stage has something to write.</Pitfall>
  <Pitfall>Recording a load-bearing decision — a breaking change, a dropped criterion, a known limitation — only in the workspace. It is invisible to everyone else, so it effectively does not exist.</Pitfall>
  <Pitfall>`/develop` editing `spec.md` to make the work fit. A wrong SPEC is a `/specification` refine, not something to patch around.</Pitfall>
  <Pitfall>Persisting the execution plan as a file. It is stale the moment the working tree moves, and a later session reads a stale plan as current.</Pitfall>
  <Pitfall>Starting work without reading `notes.md` — then spending an afternoon on an approach that was already tried and ruled out.</Pitfall>
  <Pitfall>A `test-plan.md` that just restates the unit specs. If every case is `pnpm test`, there is no QA plan, only a coverage report.</Pitfall>
  <Pitfall>A QA case with no command and no stated pass condition — nobody can run it, so it will not be run.</Pitfall>
  <Pitfall>Overwriting `notes.md` instead of appending. The dead ends are the point.</Pitfall>
  <Pitfall>Deleting a workspace when its issue closes. It costs nothing and holds the only record of the alternatives.</Pitfall>
  <Pitfall>Treating the workspace as a substitute for the issue. `.project/` is gitignored — for anyone but you, it is not there.</Pitfall>
</Pitfalls>

<References>
  <Ref skill="spec-driven" reason="The SPEC's content, section structure, and evidence discipline — this skill owns only where it lives." />
  <Ref skill="github-issues" reason="What belongs in the public issue rather than the workspace, and why no stage writes an issue body." />
  <Ref doc="task-workspace skill: templates/test-plan.md" reason="The QA / acceptance plan's shape — protocol, transport matrix, consumer flows, compatibility, regression, upgrade path." />
  <Ref doc="task-workspace skill: templates/verification.md" reason="The AC → evidence record's shape." />
  <Ref doc="task-workspace skill: templates/notes.md" reason="The append-only findings log's shape." />
  <Ref doc="CLAUDE.md" reason="The evidence and honesty standards the workspace inherits, and the quality gate the verification record is filled from." />
</References>
