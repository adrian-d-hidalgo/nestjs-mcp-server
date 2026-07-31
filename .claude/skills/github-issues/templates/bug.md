# Bug issue body — Mode B

Owned by the `github-issues` skill. Mirrors the section order of
`.github/ISSUE_TEMPLATE/bug_report.yml` so a maintainer-authored issue reads identically to a
form-submitted one. Reporter-only fields (Prerequisites, Contribution, Code of Conduct) are
dropped — see the skill's `<ReporterOnlyFields>`.

Title: `[Bug]: <the observable failure, verbatim where it has an exact string>`
Labels: `bug` (+ `triage` only when filing an inbound report on someone's behalf,
+ `priority: high|medium` per the skill's `<Priority>`).

````markdown
## Package Version

<version where the bug was observed, or `current \`main\` @ <short sha>`>

## NestJS Version

<version, or `N/A — reproduced from the test suite`>

## Bug Description

<1–2 lines: what fails, and what a consumer of the package observes. Verbatim error string if
there is one.>

## Expected Behavior

<How the feature behaves in the absence of the bug, from the consumer's point of view. One short
paragraph or 2–3 bullets. This sets the contrast for Steps to Reproduce: a reader should know what
"working" looks like before reading the failing steps.>

## Steps to Reproduce

<Fill ONLY if (a) the reporter provided steps you validated, or (b) you reproduced it yourself.
Otherwise state one of the four reproduction outcome states from the `bug-diagnosis` skill —
`Reproduced` / `Not reproducible` / `Reproduction blocked` / `Not reproduced` — and explain.
An empty section is a lie by omission.>

1. <exact verified step>
2. <exact verified step>

## Reproduction Code

<The minimal code that demonstrates the issue. Must be plausible against the real exports in
`src/index.ts`. Prefer a failing spec or a runnable example under `examples/` when one exists —
name it here.>

```typescript
import { McpModule, Resolver, Tool } from '@nestjs-mcp/server';
// minimal reproduction
```

## Environment

<Development | Testing | Production | CI/CD Pipeline — or `N/A — reproduced from the test suite`>

## Environment Details

- OS:
- Node.js version:
- Package manager:
- TypeScript version:
- MCP SDK version:
- Transport: <stdio | SSE | streamable HTTP | N/A>

## Error Logs

<First-party frames and the verbatim diagnostic only. Never a whole `node_modules` stack.>

```shell
<verbatim output>
```

## Root cause

<Not a form field — added by `/debug` after the RCA. Requires evidence: a `codegraph`- or
`Read`-verified `file:line`, a compiler diagnostic, or an observed reproduction. Confidence rides
inline as [Verified] / [Inference] / [Unverified]. Never "TBD" — defer creation instead.>

## Impact Level

<Critical | High | Medium | Low — the input to the priority label.>

## Acceptance criteria

<Not a form field — added by `/constitution` or `/debug`. Each criterion describes what a
**consumer of the package** can do / see / stop seeing after the fix. For a purely internal defect
(a leaked timer, a test flake), an internal criterion is fine — justify in one line why it is not
consumer-facing.>

- [ ] <consumer-facing criterion>
- [ ] A regression test fails without the fix and passes with it

## Current Workaround

<Any temporary workaround, or `None available`. This is what consumers read first while waiting.>

## Additional Context

<Affected files as `file:line` (codegraph/grep-verified only), related issues as `Related: #N`,
sequencing as `Blocked by #N`, and the note that the fix ships only once a release is dispatched.>
````
