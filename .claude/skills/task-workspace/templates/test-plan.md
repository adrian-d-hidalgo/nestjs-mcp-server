<!--
## QA / acceptance test plan — .project/tasks/issue-<N>/test-plan.md

Written by /specification alongside spec.md, BEFORE implementation. Executed by /develop, whose
results land in verification.md.

THIS IS NOT THE UNIT SPECS. The unit and e2e specs are the developer's job and live in src/ and
test/; they are named here only as the coverage floor this plan sits on top of. This file covers
what a QA pass exercises: what a real consumer and a real MCP client observe.

If every case in this file is "run pnpm test", there is no QA plan here — only a coverage report.

Every case states the COMMAND that runs it, what is OBSERVED, and what PASS means. A case nobody
can execute from the text will not be executed.

Delete this comment block when writing the real file. Sections that genuinely do not apply are
marked `_n/a_` WITH THE REASON — never silently dropped.
-->

# QA test plan — #<N> <issue title>

**SPEC:** `.project/tasks/issue-<N>/spec.md` · **Authored:** <YYYY-MM-DD>

## Scope

One line: what behaviour this plan verifies, and what it deliberately does not (because the unit
specs cover it).

## Developer-test floor

Not this plan's job — named so the boundary is explicit and so a gap is visible.

- Unit specs expected: `src/<path>.spec.ts` — <what they assert>
- E2E specs expected: `test/<name>.e2e-spec.ts` — <what they assert>

## 1. Protocol-level behaviour

What a real MCP client sees. Run the Inspector against the relevant example; this is the only rung
that exercises the actual wire protocol.

| # | Case | Command | Observe | Pass when |
| --- | --- | --- | --- | --- |
| P1 | <e.g. the new tool is listed> | `pnpm start:inspector` + `EXAMPLE=tools pnpm start:example` | <what to look at in the Inspector> | <the observable condition> |

## 2. Transport matrix

Run the same scenario across the transports the change touches. A change that works on stdio and
breaks SSE is the classic escape from unit-level testing.

`_n/a_` only when the change provably carries nothing across a transport — say why.

| # | Scenario | stdio | SSE | streamable HTTP |
| --- | --- | --- | --- | --- |
| T1 | <scenario> | <expected> | <expected> | <expected> |

## 3. Consumer flows

The affected examples must start and serve — `CLAUDE.md` requires this whenever the public API
changed. Available: `tools`, `guards`, `prompts`, `resources`, `mixed`, `for-root-async`.

| # | Example | Command | Pass when |
| --- | --- | --- | --- |
| C1 | `<name>` | `EXAMPLE=<name> pnpm start:example` | starts without error and serves <what> |

## 4. Compatibility

The declared support surface still holds. Relevant whenever types or module wiring move.

| # | Dimension | Check | Pass when |
| --- | --- | --- | --- |
| K1 | NestJS peer range | build against the lowest version in `peerDependencies` | compiles clean |
| K2 | Node version | the version in `.nvmrc` | suite green |
| K3 | TypeScript strictness | a consumer-shaped `tsconfig` with `strict: true` | no new diagnostics |

## 5. Regression surface

What *else* shares the code being changed. This is the section that catches the damage nobody
predicted — fill it from `codegraph_impact` on the changed symbols, not from intuition.

| # | Adjacent behaviour | Why it is at risk | Smoke check |
| --- | --- | --- | --- |
| R1 | <e.g. the other decorators reading the same metadata> | <the shared code path> | <command> |

## 6. Upgrade path

**Required whenever the SPEC called this `feat!`.** What a consumer must edit — verified against a
real example, not asserted from the diff.

`_n/a_` when `SemVer impact` is not MAJOR.

| Before | After | Verified by |
| --- | --- | --- |
| `<old consumer code>` | `<new consumer code>` | <the example, edited and run> |

## Out of scope

What this plan deliberately does not cover, and why. An explicit gap is a decision; a silent one is
a hole.
