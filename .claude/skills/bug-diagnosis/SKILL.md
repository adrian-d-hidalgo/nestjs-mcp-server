---
name: bug-diagnosis
description: "Bug diagnosis protocol for @nestjs-mcp/server: phases 0-4, the deprecation check, evidence-before-reproduction, the reproduction route matrix (failing spec / e2e / MCP Inspector / examples), the certainty bar, and the tooling matrix. Load at the start of any bug investigation or RCA."
---

<Purpose>
Install the bug-diagnosis reflex for a **library**: a source-agnostic protocol (a consumer report,
a failing CI run, a compiler diagnostic, an observation) that goes static-review-first,
evidence-before-reproduction, and never advances on assumption. The five phases (0 capture →
1 static review + deprecation check → 2 evidence + reproduction → 3 diagnose at the cause →
4 regression test last + close the loop) produce a diagnosis that names a specific file, symbol,
or invariant and is backed by a failing test, a grepped code path, a verbatim diagnostic, or a
reporter quote. Anything less is not done.

**The library difference:** there is no running production system to read logs from. Every piece
of evidence here has to be *created* — a failing spec, an e2e run, an Inspector session, a running
example. That makes Phase 2 more work than in an application, and makes the temptation to skip
straight to a plausible-sounding cause much stronger. Resist it: `CLAUDE.md` is explicit that
*"a fix grounded in `[Inference]` is not done — get the evidence or say you couldn't and stop."*
</Purpose>

<WhenToUse>
  <Trigger>A consumer-reported bug lands (a GitHub issue, a discussion, a stack trace) and you must diagnose it.</Trigger>
  <Trigger>A failing spec, a red CI run, or an unexpected `pnpm test:e2e` failure.</Trigger>
  <Trigger>A TypeScript diagnostic a consumer hits that the repository's own build does not.</Trigger>
  <Trigger>A post-release regression, or a behaviour that contradicts the README / examples.</Trigger>
  <Trigger>Anything described as "the tool isn't registered", "the session drops", "the handler never fires", "it hangs".</Trigger>
  <Trigger>About to write a reproduction plan, or to judge whether a cause is proven.</Trigger>
  <Trigger>About to persist a confirmed bug as a GitHub issue and you need the certainty bar satisfied first.</Trigger>
</WhenToUse>

<WhenNotToUse>
  <Case>Capabilities that were never built, or refactors with no observed defect — those are Mode C / Mode R / Mode X in the `github-issues` skill, not bugs.</Case>
  <Case>Docs and typos.</Case>
  <Case>A consumer's own misuse that the types already reject — that is a documentation gap (Mode D), and saying so is the finding.</Case>
</WhenNotToUse>

<EntryDecision>
Source-agnostic entry. Pick the path before doing anything:

  <Branch detected-via="an existing GitHub issue">Read it and its comments (`issue_read`) as the verbatim report, then run Phase 0 → 4 here.</Branch>
  <Branch detected-via="a failing test or CI run">The failure output IS Phase 0's capture and often most of Phase 2's evidence. Start at Phase 1 — the deprecation check still applies.</Branch>
  <Branch detected-via="anything else (a symptom, a stack trace, an observation)">Run Phase 0 → 4 here directly.</Branch>
  <Branch after-diagnosis="persist as an issue">Use the `github-issues` skill (Mode B) to shape and propose it.</Branch>
  <Branch after-diagnosis="do not persist">Report why — a deprecated path, a consumer misuse, an upstream SDK bug. Each has a different outcome and none of them is silence.</Branch>

If unsure where to start: start at Phase 0.
</EntryDecision>

<Phases>

  <Phase n="0" title="Capture verbatim">
Capture **without paraphrasing** before any action. If a field is missing, **ask** — never fill it
with an assumption. On an existing issue, ask in the issue's comments and do not advance to the RCA
until it is answered.

| Field | For this project |
| --- | --- |
| Exact wording | the error string, the `tsc` diagnostic (`TS2589`), the SDK error, the issue title — verbatim |
| Where | which export or decorator (`@Tool`, `@Resource`, `@Prompt`), which protocol era (`2026-07-28` modern vs the 2025 legacy fallback), which module option |
| Versions | `@nestjs-mcp/server`, `@nestjs/common`, `@modelcontextprotocol/sdk`, TypeScript, Node |
| When | which version it started at, or whether it ever worked |
| Expected vs observed | what the consumer expected, and what actually happened |

Deliverable: a verbatim report with every field filled or explicitly marked unknown.
  </Phase>

  <Phase n="1" title="Static review — always first">
Static review is **always step 1**. Don't reproduce or write a spec before reading the code — the
bug may be in a path that no longer exists, and you would have built a reproduction for nothing.

**§1.1 Deprecation check (mandatory, blocking).** Does this apply to current `main`?

```sh
# codegraph first — it answers kind + location + signature in one call
codegraph_search "<symbol from the report>"
```

| Result | Action |
| --- | --- |
| Symbol not found in `src/` | The path was removed or renamed. **Stop.** Report which release removed it and, if the consumer is on an older version, that upgrading is the fix. No issue. |
| Symbol found | Continue. |

A reported bug against a version older than `main` needs one extra question: *does it still
reproduce on `main`?* If it was already fixed, the finding is "fixed in vX, pending release" —
which is a real and useful answer, not a non-answer.

**§1.2 Trace the path.** The symptom's surface is not always where the cause lives — a decorator
bug surfaces at request time, a transport bug surfaces as a missing handler. Use codegraph rather
than grep for structure:

```sh
codegraph_callers "<symbol>"     # what depends on this
codegraph_callees "<symbol>"     # what this depends on
codegraph_impact  "<symbol>"     # what breaks if it changes
```

**§1.3 Cross-reference the other channels.** The bug surfaced through one channel; check the rest:

| Channel | How |
| --- | --- |
| Existing GitHub issues, open **and** closed | `search_issues` — the duplicate-check query in the `github-issues` skill |
| The test suite | is there already a spec covering this path, and does it pass? |
| The examples | does the matching `examples/<name>` still work? |
| Upstream | is this actually an `@modelcontextprotocol/sdk` bug? Check its changelog via `context7` before blaming first-party code |

Upstream attribution matters here: this repository's advisories and several of its type problems
have originated in the SDK, not in first-party code. Getting that wrong sends the fix to the wrong
place.

**§1.4 Recent commits in suspect files.** When the bug is recent or tied to a version:

```sh
git log --oneline -15 -- src/<suspect-path>
git log --oneline --since="<report date>" -- src/
```

Read the diff of any commit touching a suspect file. **Read only** — `git log` and `git diff` are
safe; nothing in this phase mutates.

**§1.5 Phase 1 outputs:**

- ✅ Path lives, suspect cause identified → Phase 2.
- ❌ Path deprecated / already fixed on `main` → report it, **stop**.
- 🤔 Path lives, cause unclear → Phase 2 to build the evidence.

Deliverable: `applies + suspect cause` / `deprecated → stop` / `applies + cause unknown`.
  </Phase>

  <Phase n="2" title="Evidence — build the smallest thing that fails">
There are no production logs to read. Evidence here is **constructed**, and the discipline is to
construct the *smallest* thing that fails, at the *lowest* level that still reproduces it.

Pick the route by surface — the matrix in `<ReproductionRoutes>` below. Escalate only when the
cheaper route does not reproduce it:

```
a failing unit spec  →  an e2e spec  →  the MCP Inspector  →  a running example
```

A reproduction that only fails at the top of that ladder is itself a finding: it means the bug is
in the wiring, not the logic.

- ✅ Cause **proven** by a failing test or an observed session → Phase 3.
- 🤔 Cause **suspected but not proven** → keep going down the ladder, or escalate to the user with
  a specific ask (`<AskTheHuman>`).
- ❌ No reproduction at any level → **park it**. Say `Not reproducible` and what you tried. Do not
  invent a cause to fill the gap.

Deliverable: a reproduction that fails, or an explicit reproduction outcome state.
  </Phase>

  <Phase n="3" title="Diagnose at the cause">
**§3.1 Trace the symptom backward.** Walk it: the observable failure → the code that produced it →
the invariant that was broken → the change that broke it. The symptom is "the tool never appears
in `tools/list`"; the cause is "the decorator writes metadata under a key the registry reads with
a different symbol". Fix the cause.

**§3.2 Surface vs cause.** A cause in the decorator layer surfacing at the transport layer gets
fixed in the decorator, with validation added at the transport boundary only if the boundary
should have rejected it. Without the cause fix the bug returns through another path.

**§3.3 Don't paper over.** Anti-patterns: catch-and-ignore, a default value for a missing required
field, a widened type that silences the error without fixing the shape, `as any`. They hide the
cause and they ship to consumers. If the cause genuinely cannot be fixed in scope, propose it as
Mode X debt (`github-issues` skill) with a `// TODO(#<N>):` marker and a closure condition —
never a silent workaround.

**§3.4 Upstream causes.** If the cause is in `@modelcontextprotocol/sdk`, the fix here is a
deliberate choice among: pin, override, wrap, or wait — stated with its consequence, not defaulted
to. File upstream too, and reference it.

Deliverable: a cause named as a specific `file:line` or invariant, verified against Phase 2's
reproduction.
  </Phase>

  <Phase n="4" title="Regression test after the cause, BEFORE the fix + close the loop">
The test comes after the **diagnosis** and before the **fix**. Order:

1. Static review (Phase 1) confirms the bug is real on current `main`.
2. A reproduction (Phase 2) proves the cause.
3. **Now** write the regression test — and **run it, and read the failure**, confirming it fails for
   the reason the diagnosis predicted.
4. The fix lands at the cause, and the test goes green.

Both halves of that ordering matter, for different reasons:

- **After the diagnosis**, because a test written before the cause is known tests a guess — it will
  assert the wrong thing or pass by coincidence.
- **Before the fix**, because that is the only way to *prove* it fails without the fix. Written
  afterwards you would have to revert the fix to check, which nobody does — and that is exactly how
  a test that passes either way ships.

The deliverable is a test **observed** failing for the expected reason, then passing with the fix.
"It would have failed" is an unverifiable claim, not evidence. The full protocol — including which
kinds of work invert this or skip it entirely — is owned by the `test-first` skill.

**Where the test goes:**

| The bug is in… | Test |
| --- | --- |
| Decorator metadata, registry logic, guards, pure logic | a co-located `*.spec.ts` in `src/` |
| Transport wiring, protocol-era behaviour, concurrent clients | an e2e spec in `test/` — `base`, `concurrent-clients`, `protocol-eras`, `stateless-load-balancing`, `mcp-features`, `examples-smoke` |
| The public surface a consumer imports | both — plus a check that the relevant `examples/` still runs |

**What NOT to test:** upstream SDK behaviour with a faithful-looking mock that just re-asserts your
assumption about the SDK. If the claim is about the SDK, exercise the real SDK.

**Close the loop:**

| Action | Detail |
| --- | --- |
| Coverage | the new spec must not drop the thresholds in `package.json` (80% statements / 55% branches / 70% functions / 85% lines) |
| Quality gate | the full five-phase gate from `CLAUDE.md`, run to completion — skipping a phase is silent breakage |
| Issue | propose it via the `github-issues` skill (Mode B). Create only on authorization |
| Commit | suggested, never run: `fix(<scope>): <subject>` with `Closes #N`. **You never run git** (`CLAUDE.md`) |
| Partial fix | Mode X debt issue with a closure condition + `// TODO(#<N>):` |
| Recurring class | at ≥3 recurrences with the same root cause, propose the structural fix instead of patching again |

Deliverable: a regression test that fails without the fix, the gate green, the issue proposed.
  </Phase>

</Phases>

<ReproductionRoutes reason="the library replacement for an application's logs and observability — evidence is built, not read">

| Surface under suspicion | Route | Command |
| --- | --- | --- |
| Decorator metadata, registry, guards, pure logic | a failing co-located spec | `pnpm test -- src/<path>.spec.ts` |
| Transport, session lifecycle, cleanup | a failing e2e spec | `pnpm test:e2e` |
| Protocol-level behaviour (what a real MCP client sees) | the MCP Inspector against an example | `pnpm start:inspector` |
| End-to-end consumer experience | the matching example | `EXAMPLE=tools pnpm start:example` (also: `guards`, `prompts`, `resources`, `mixed`, `for-root-async`) |
| A consumer's compile error | the consumer's exact `tsconfig.json` strictness, reproduced in a fixture | `pnpm typecheck` |
| A dependency advisory | the audit itself | `pnpm audit` |

  <Pattern name="Start at the cheapest rung">
A unit spec runs in seconds and points at a line. The Inspector needs a process, a transport, and
a human reading a session. Escalate only when the cheaper rung does not reproduce the failure —
and note **which rung first reproduced it**, because that fact locates the bug: a failure that only
appears at the Inspector but not in an e2e spec is a wiring or serialization bug, not a logic bug.
  </Pattern>

  <Pattern name="A consumer's type error needs the consumer's tsconfig">
Type bugs (`TS2589` and its family) are **configuration-sensitive**. This repository's own
`tsconfig.json` may not have the strictness that triggers the consumer's error, which is exactly
why "it builds fine here" is not evidence of anything. Reproduce with the reporter's compiler
settings and TypeScript version, or record `Not reproduced` and say which settings you tried.
Do not close a type report because the local build is green.
  </Pattern>

  <Pattern name="Force the precondition instead of recreating the happy path">
To reproduce a session-cleanup bug, don't drive a full client session hoping it expires — construct
the expired state directly in a spec. The existing e2e specs in `test/` show the pattern; reuse
their setup rather than inventing a new harness.
  </Pattern>

  <Pattern name="Never mutate to investigate">
Diagnosis is read-only. `git log`, `git diff`, `codegraph_*`, `Read`, `Grep`, and running tests
are all safe. Anything that rewrites history, publishes, or pushes is prohibited outright by
`CLAUDE.md` and blocked by the destructive-command hook — including "just to check whether the
fix works on main".
  </Pattern>
</ReproductionRoutes>

<AskTheHuman>
When evidence cannot be built without the reporter, ask precisely. Be specific:

| Gap | Ask for |
| --- | --- |
| No reproduction | The minimal `McpModule.forRoot` config plus the resolver that triggers it |
| Version unknown | The three versions from their lockfile: `@nestjs-mcp/server`, `@nestjs/common`, `@modelcontextprotocol/sdk` |
| Type error | The verbatim `tsc` output and their `tsconfig.json` `strict` / `skipLibCheck` settings |
| Transport unclear | Which transport, and whether sessions are enabled |
| Intermittent | Whether it survives a clean `node_modules` and lockfile install |

❌ "Send more info." ✅ "Can you paste the exact `tsc` output and the `paramsSchema` for the failing
tool?" If the user can't provide it, **park** — don't synthesize.
</AskTheHuman>

<CertaintyBar>
The diagnosis is done when it names a cause with evidence. Before proposing a fix or an issue,
**all yes**:

- [ ] The bug is real on **current `main`** (the §1.1 deprecation check passed).
- [ ] A reproduction exists — a failing spec, a failing e2e, an observed Inspector session, or a
      broken example — **or** an explicit reproduction outcome state is recorded.
- [ ] The root cause names a specific `file:line`, symbol, or invariant, sourced from a
      `codegraph_*` or `Read` call run this session.
- [ ] The cause is attributed correctly: first-party vs `@modelcontextprotocol/sdk` vs consumer
      misuse.
- [ ] Impact is stated as what a consumer observes, not estimated.

Any `no` / `unknown` → don't propose the fix or the issue. Continue diagnosing or ask the user.
`CLAUDE.md` is the standard: *"Any claim without evidence is labeled `[Unverified]` or
`[Inference]`."*

  <DecisionTable name="Reproduction outcome states — one of these goes in Steps to Reproduce">
| State | Means | What goes in the issue |
| --- | --- | --- |
| `Reproduced` | You made it fail, deliberately | the exact steps or the failing spec's path |
| `Not reproducible` | You tried the routes and it never failed | which routes you tried, and with what settings |
| `Reproduction blocked` | You cannot try — missing versions, missing config, a consumer-only environment | exactly what is missing and who was asked |
| `Not reproduced` | You did not attempt it (the cause was proven statically, e.g. a verbatim diagnostic plus the code path) | why the static evidence is sufficient |

Never leave the section empty. An empty `Steps to Reproduce` reads as "reproduced" to everyone
who opens the issue.
  </DecisionTable>
</CertaintyBar>

<DiagnosticMatrix>
| Symptom | First place to look |
| --- | --- |
| A tool / resource / prompt never appears to the client | decorator metadata and the registry — `src/decorators/`, then the registry service |
| The handler never fires | the resolver class uses `@Injectable()` instead of `@Resolver()` (a `CLAUDE.md` core pattern, not lintable) |
| A guard behaves differently under `@UseGuards` vs `APP_GUARD` | the two guard scopes are genuinely different context types (`CLAUDE.md`) — verify which one is in play before diagnosing further |
| The session drops or leaks | `src/transports/` plus the e2e specs in `test/` that already cover session lifecycle |
| `TS2589` / deep instantiation | the generic chain from `paramsSchema` into the SDK — and the reporter's TypeScript version, which is usually load-bearing |
| A dependency advisory | whether it is transitive via `@modelcontextprotocol/sdk` before assuming first-party |
| It works locally but not for the consumer | tsconfig strictness, package manager, or an unbuilt `dist/` — compare their versions against the lockfile |
| It broke after a release | `git log` between the two tags, and whether the change was correctly typed as `feat!` |
</DiagnosticMatrix>

<Conventions>

- **Codegraph before grep** for structural questions — it returns kind, location, and signature in
  one call and is faster than a grep-and-read loop (`CLAUDE.md`). Grep is for literal text: an
  error string, a comment, a log message.
- **Read the whole failing test output**, not the first line. Jest's assertion diff usually names
  the invariant directly.
- **Verbatim, always.** Diagnostics, SDK error strings, and stack frames are pasted as emitted.
- Diagnosis produces a **finding**, not a ticket. Persisting it is the `github-issues` skill's job
  and needs its own authorization.

</Conventions>

<Examples>

  <Example name="Deprecation check run before anything else" kind="do">

```md
`codegraph_search "ToolParamsRawShape"` → declared at `src/mcp.types.ts:41`, exported from
`src/index.ts:12`. The path is alive on `main`, so the report applies. [Verified]
```

Thirty seconds of static review before any reproduction is built — and it is the step that stops
you from writing a spec for code that was deleted two releases ago.
  </Example>

  <Example name="Building a reproduction for a path that no longer exists" kind="dont">

```md
The reporter is on 0.9.1 and says `registerToolLegacy` throws. Let me write an e2e spec that
calls it and see what happens.
```

`registerToolLegacy` is not in `src/` on `main`. The spec will not even compile, and the real
answer — "removed in 1.0.0, upgrade" — was one codegraph call away.
  </Example>

  <Example name="Reproduction escalated one rung at a time, and the rung recorded" kind="do">

```md
Unit spec against the registry passes — the metadata is written correctly. The e2e spec in
`test/` reproduces it: the tool is registered but absent from `tools/list` over streamable
HTTP. First reproduced at the e2e rung, so the cause is in transport wiring, not the
decorator. [Verified]
```

The rung that first fails is itself diagnostic information, and recording it narrowed the search
to one directory.
  </Example>

  <Example name="A cause asserted without a reproduction" kind="dont">

```md
## Root cause
The session store probably isn't keyed by session id on the HTTP transport, so concurrent
clients overwrite each other. That would explain the symptom.
```

"probably" / "would explain" with no failing test and no cited line. This is `[Inference]`, and
`CLAUDE.md` is explicit that a fix grounded in it is not done.
  </Example>

  <Example name="Attributing a cause upstream, with evidence" kind="do">

```md
The advisory is on `<transitive-package>`, pulled in by `@modelcontextprotocol/sdk`, not by
first-party code — `pnpm why <transitive-package>` shows the SDK as the only path. The fix is
an SDK bump, not a change in `src/`. [Verified]
```

Names the source, shows the command that proved it, and routes the fix to the right place.
  </Example>

  <Example name="Closing a type report because the local build is green" kind="dont">

```md
`pnpm typecheck` passes here, so I can't reproduce it — closing as not-a-bug.
```

The repository's own tsconfig is not the consumer's. Type bugs are configuration-sensitive; the
honest outcome is `Not reproduced` with the settings tried, plus a request for theirs.
  </Example>

</Examples>

<Pitfalls>
  <Pitfall>Skipping Phase 0 — paraphrasing an error string drops the exact token everyone will search for.</Pitfall>
  <Pitfall>Skipping the deprecation check → a reproduction, a fix, and an issue for a path that no longer exists.</Pitfall>
  <Pitfall>Jumping to the Inspector or an example when a unit spec would have reproduced it in seconds.</Pitfall>
  <Pitfall>Not recording which rung first reproduced the failure — that fact locates the bug.</Pitfall>
  <Pitfall>Treating "it builds / typechecks here" as evidence about a consumer's compile error.</Pitfall>
  <Pitfall>Blaming first-party code for an SDK bug (or the reverse) without running the check that distinguishes them.</Pitfall>
  <Pitfall>Writing the regression test before the cause is identified — it passes by coincidence.</Pitfall>
  <Pitfall>A test that passes with and without the fix. That is not a regression test.</Pitfall>
  <Pitfall>Papering over: `as any`, a widened type, a default for a missing required field, catch-and-ignore.</Pitfall>
  <Pitfall>Trial-and-error patching — each iteration mutates the system you are trying to understand.</Pitfall>
  <Pitfall>Treating "it compiles" as verification. Types verify code, not behaviour (`CLAUDE.md`).</Pitfall>
  <Pitfall>Running any git mutation during diagnosis. Investigation is read-only.</Pitfall>
  <Pitfall>Leaving `Steps to Reproduce` empty instead of stating one of the four outcome states.</Pitfall>
  <Pitfall>Closing the loop without a regression test and without a Mode X debt issue in its place.</Pitfall>
</Pitfalls>

<References>
  <Ref skill="github-issues" reason="Persisting a confirmed bug as a Mode B issue; the certainty bar it inherits; the duplicate check that runs before creation." />
  <Ref skill="spec-driven" reason="When the root cause is not obvious from a single Read pass, the bug-shaped SPEC captures the analysis on the issue." />
  <Ref doc="CLAUDE.md" reason="The honesty bar ([Unverified]/[Inference]), the five-phase quality gate, the core resolver/guard patterns the DiagnosticMatrix keys off, and the no-autonomous-git rule." />
  <Ref doc="test/base.e2e-spec.ts" reason="The existing e2e harness to reuse when a reproduction needs a transport rather than a unit spec." />
  <Ref doc="examples/README.md" reason="Which example exercises which surface — the top rung of the reproduction ladder." />
</References>
