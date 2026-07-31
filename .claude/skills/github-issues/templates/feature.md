# Capability issue body — Mode C

Owned by the `github-issues` skill. Mirrors `.github/ISSUE_TEMPLATE/feature_request.yml`.

For a **missing capability** — something the package should be able to do but can't yet. It is
**not** a bug: there is no `Root cause`, no `Steps to Reproduce`, no stack trace. If you find
yourself writing those, it is a bug → use `templates/bug.md`.

Title: `[Feature]: <the capability, stated as what a consumer gains>`
Labels: `enhancement` (+ `priority: high|medium` per the skill's `<Priority>`).

````markdown
## Package Version

<version the proposal targets, or `current \`main\` @ <short sha>`>

## NestJS Version

<the NestJS version range this must work against>

## Problem Statement

<1–2 short paragraphs: what a consumer cannot do today, and why that matters. Names the gap, not
the implementation. If there is a real consumer report or issue behind it, cite it as
`Related: #N`.>

## Proposed Solution

<The capability at the level of behaviour and surface — what is exported, what it does, how it
composes with the existing decorators and module options. No file-by-file plan; that is the SPEC's
job, authored later by `/specification`.>

## Feature Type

<Enhancement to existing functionality | New functionality | Performance improvement |
Developer experience | Integration with other tools/libraries | Configuration options>

## Usage Example

<MANDATORY and the heart of the issue: the TypeScript a consumer writes once this exists. It is
the API proposal in its most reviewable form — write it BEFORE the prose above. Must be
compile-plausible against the real exports in `src/index.ts`; check them with codegraph rather
than recalling them.>

```typescript
import { McpModule, Resolver, Tool } from '@nestjs-mcp/server';

// what the consumer writes once this capability exists
```

## Acceptance criteria

<Not a form field — added by `/constitution`. Gherkin when the capability has conditional states
(opt-in gating, transport-dependent behaviour, cascading defaults); a flat consumer-facing
checklist when it has none.>

```gherkin
Scenario: <name>
  Given <precondition>
  When <consumer action>
  Then <observable outcome>
```

## Alternatives Considered

<The designs not taken and why. "None" is almost always a sign the space was not explored — the
existing SDK surface, a userland workaround, and a narrower version of the same idea are usually
all real alternatives.>

## Impact Level

<Critical | High | Medium | Low — the input to the priority label.>

## Additional Context

<Which `@modelcontextprotocol/sdk` types this would build on (SDK types first — `CLAUDE.md`),
whether it is additive (`feat`, MINOR) or breaking (`feat!`, MAJOR) per
`.handbook/GIT_GUIDELINES.md`, affected files as verified `file:line`, and any
`Related: #N` / `Blocked by #N`.>
````
