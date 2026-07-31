# Technical task body — Mode T (and Mode X, technical debt)

Owned by the `github-issues` skill. **No `.github/ISSUE_TEMPLATE` form covers this shape** — that
is why issues like #119 (`chore(deps): update all dependencies…`), #113 (`chore(deps): migrate to
TypeScript 6`) and #112 were hand-written. This template is the missing shape, kept skill-side so
`.github/` stays untouched.

For engineering work that is **neither a defect nor a consumer-facing capability**: dependency
bumps, toolchain migrations, CI/workflow changes, release plumbing, build configuration, and
accepted technical debt.

Title: Conventional-Commits-shaped, **no bracket prefix** — `chore(deps): migrate to TypeScript 6`,
`ci(workflows): bump GitHub Actions to Node 24 runners`.
Labels: `chore` (+ `devops` when it lands in `.github/workflows/`, + `priority: high|medium`).

**Mode X (technical debt) uses this same body**, with `Closure condition` as the point of the
issue rather than a formality. There is no `debt` label in this repository — do not invent one.
Mode X is justified only when all four of the skill's conditions hold: the gap is real today, it is
not a bug, it is not a capability, and it has a verifiable closure condition.

````markdown
## Summary

<1–2 lines: the work, and why it is needed now. Names the gap or the trigger (an upstream EOL, an
advisory, a deprecation warning), not the implementation.>

## Current state

<How things actually are today, read from the repository this session — versions from
`package.json`, runner versions from `.github/workflows/`, the real code path as `file:line`.
Every claim codegraph- or grep-verified; confidence inline as [Verified] / [Inference].>

## Target state

<The end state, concretely. Versions, configuration, and what disappears. Not "modernise the
toolchain" — the actual diff in outcome terms.>

## Rationale

<Why now, and what happens if it waits. An upstream end-of-life date, an open advisory, a
blocked capability. For Mode X: why this was accepted as a trade-off rather than fixed.>

## Closure condition

<MANDATORY, and the section that makes this issue closable. A mechanically verifiable trigger —
not a feeling. Examples that qualify:

- `pnpm typecheck` passes with `"typescript": "^6"` and `pnpm knip` reports no new unused exports
- `grep -rn "actions/setup-node@v4" .github/workflows/` returns 0
- `pnpm audit` reports zero high-severity advisories
- the five-phase gate is green and `examples/` still run

"When we have bandwidth" / "once the ecosystem catches up" is not a trigger — an issue with one of
those lives forever.>

## Risks

<The regression surface. What could break that the type checker will not catch, and which specs
cover it. For a dependency bump: which transitive versions move and whether any is a major.>

## Current workaround

<Mode X only: the tactical patch in place today, with its `file:line` and its
`// TODO(#<N>): <one-line summary>` marker if one exists. Omit for Mode T — nothing is broken.>

## Additional Context

<Scope in structural terms, never time (`CLAUDE.md` prohibits estimates). `Related: #N` /
`Blocked by #N`. State the release consequence per `.handbook/GIT_GUIDELINES.md`: `chore:` and
`refactor:` produce **no release**; only `fix:` / `feat:` / `feat!:` do — though this repository's
release workflow also triggers a patch on `build(deps):` and `chore(deps):` (issue #117).>
````
