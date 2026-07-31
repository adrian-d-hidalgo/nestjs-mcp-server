# Security issue body — Mode S

Owned by the `github-issues` skill. Mirrors `.github/ISSUE_TEMPLATE/security.yml`.

**BLOCKING GATE — read before drafting anything.** This form is for **non-critical** issues only.
If the vulnerability is remotely exploitable, or exposes consumer secrets, credentials, or the
host filesystem, it goes through **private disclosure**, not a public issue. Stop and tell the
user. Do not draft a public issue that hands out a working exploit. The form's severity dropdown
deliberately offers only Low / Medium / High — the absence of "Critical" is that signal.

Title: `[Security]: <the weakness, not the exploit>`
Labels: `security` (+ `priority: high` when severity is High).

Most security work in this repository is **dependency advisories**, and the source matters:
advisories here have historically arrived transitively through `@modelcontextprotocol/sdk` rather
than first-party code. State which, with the resolution path.

````markdown
## Package Version

<affected version range, or `current \`main\` @ <short sha>`>

## NestJS Version

<version, or `N/A — dependency advisory, transport-independent`>

## CVE Identifier

<CVE / GHSA id, or `N/A — no advisory assigned`>

## Vulnerability Type

<Exposure of Sensitive Information | Information Leak / Disclosure | Input Validation |
Insecure Default Configuration | Path Traversal | Insecure Dependency | Authentication Issue |
Authorization Issue | XSS | CSRF | SSRF | Denial of Service — the form's own vocabulary.>

## Severity Assessment

<Low | Medium | High. If your honest assessment is Critical, STOP — private disclosure.>

## Vulnerability Description

<What the weakness is, in factual terms. For a dependency advisory, state explicitly whether it is
**first-party** or **transitive via `@modelcontextprotocol/sdk`** (or another dependency), and
name the resolution path: a direct bump, an override, or waiting on upstream. Cite
`pnpm audit` output or the advisory URL verbatim.>

## Potential Impact

<What a consumer of this package is actually exposed to — not the generic description of the
vulnerability class. If the vulnerable code path is unreachable from this package's public
surface, say so and prove it (which export would have to be called, and whether anything calls it).>

## Steps to Reproduce

<The minimum that demonstrates the weakness. If it cannot be reproduced from this package's
surface, state that outcome explicitly — that is itself the finding.>

## Reproduction Code

<The minimum that demonstrates the flaw. NOT a weaponised exploit.>

```typescript
// minimal demonstration
```

## Environment Details

- Node.js version:
- NestJS version:
- OS:
- MCP SDK version:
- Relevant dependencies:

## Proposed Solution

<Code change, configuration change, dependency bump, or an upstream issue to file. For a
transitive advisory, say whether a `pnpm.overrides` entry is warranted or whether it must wait on
the SDK — and what the interim exposure is.>

## Closure condition

<Not a form field — added by `/constitution`. The verifiable trigger: `pnpm audit` reports zero
advisories at this severity, the five-phase gate is green, and (where applicable) a regression test
covers the input that triggered it.>

## References

<Advisory URLs, upstream issues, OWASP references. Clickable links, never pasted commands.>

## Additional Context

<`Related: #N` / `Blocked by #N`. Note the release path: a `fix:` commit bumps PATCH, but the fix
reaches consumers only once a release is dispatched via GitHub Actions — closing the issue is not
publishing.>
````
