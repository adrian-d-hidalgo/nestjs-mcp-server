# Refactor issue body — Mode R

Owned by the `github-issues` skill. Mirrors `.github/ISSUE_TEMPLATE/refactoring.yml`.

**Defining test**, taken from the form's own prerequisite: *"this refactoring doesn't change public
API or break existing functionality."* If the surface exported from `src/index.ts` changes at all,
this is **not** Mode R — a widened type is Mode C (`feat`), a narrowed or removed one is Mode C
with a breaking change (`feat!`).

Title: `[Refactor]: <what is restructured, and the property that improves>`
Labels: `refactor` (+ `priority: high|medium` per the skill's `<Priority>`).

**`Estimated Effort` from the form is dropped** — `CLAUDE.md` prohibits time estimates outright.
State scope instead ("touches 3 decorators", "requires an SDK type change").

````markdown
## Package Version

<current \`main\` @ <short sha>>

## Code to Refactor

<The exact target: files, classes, functions — as `file:line`, codegraph- or grep-verified. Not
a vague area.>

## Package Area

<Core Module | Decorators | Guards | Session Management | Transports | Infrastructure | Testing |
Documentation — the form's own vocabulary.>

## Reasons for Refactoring

<Which apply, with the evidence for each: code duplication · complex/nested logic · performance ·
maintainability · technical debt · static-analysis warnings. A reason without a cited line or a
tool output is an opinion, not a reason.>

## Current Implementation

<Real code read from the repository this session — not sketched from memory.>

```typescript
// src/<path>.ts:<line>
```

## Proposed Changes

<What pattern replaces what, and why it is better here specifically. Whether files move, split, or
are renamed — and if so, what that does to `src/index.ts` (if the answer is "nothing", say so
explicitly; that is the Mode R gate).>

## Proposed Implementation

```typescript
// the shape after the refactor
```

## Expected Benefits

<Measurable where possible: a duplication count that drops, a `knip` warning that clears, a
complexity figure. "Cleaner" is not a benefit.>

## Potential Risks/Side Effects

<The regression surface. Which specs cover the touched code today, which do not, and what a
consumer could observe if this goes wrong. Note explicitly that the coverage thresholds in
`package.json` (80% statements / 55% branches / 70% functions / 85% lines) must still hold after.>

## Closure condition

<Not a form field — added by `/constitution`. The verifiable trigger: the five-phase gate green,
`pnpm knip` clean, coverage thresholds held, public API byte-identical (`pnpm build` then diff the
emitted `.d.ts`).>

## Impact Level

<Critical | High | Medium | Low — the input to the priority label.>

## Additional Context

<Scope in structural terms, never time. `Related: #N` / `Blocked by #N`. Note that a `refactor:`
commit produces **no release** per `.handbook/GIT_GUIDELINES.md`.>
````
