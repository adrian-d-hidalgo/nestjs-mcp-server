# Package Versioning Guidelines <!-- omit in toc -->

> For all Git branching and pull request rules, see GIT_GUIDELINES.md. This document focuses exclusively on versioning, tagging, and publishing policies.

This document describes the versioning policy and release process for all packages in the MCP Server NestJS module library. Its objective is to ensure clear, progressive, and predictable versioning for all releases, maintain compatibility with the @modelcontextprotocol/sdk, and provide guidance for stable and pre-release workflows. Use this guide to understand how to version, tag, and publish packages in this project.

## Table of Contents <!-- omit in toc -->

- [Overview](#overview)
- [Version Format](#version-format)
- [Version Bump Rules](#version-bump-rules)
- [Pre-release Identifiers](#pre-release-identifiers)
- [Release Flow](#release-flow)
  - [Standard Release](#standard-release)
  - [Pre-releases](#pre-releases)
- [Automation with semantic-release](#automation-with-semantic-release)
- [npm Tags](#npm-tags)
- [Best Practices](#best-practices)

## Overview

This project uses **semantic-release** to automate versioning based on conventional commits. Version numbers are calculated automatically from commit messages - no manual version editing is required.

## Version Format

We follow [Semantic Versioning 2.0.0](https://semver.org/) as the baseline:

```
MAJOR.MINOR.PATCH[-PRERELEASE]
```

- **MAJOR**: Incompatible API changes
- **MINOR**: Backwards-compatible functionality
- **PATCH**: Backwards-compatible bug fixes
- **PRERELEASE**: Optional, for alpha/beta/rc versions

## Version Bump Rules

Version bumps are determined automatically by commit message prefixes:

| Commit Type | Version Bump | Example |
|-------------|--------------|---------|
| `fix:` | PATCH | 0.4.0 → 0.4.1 |
| `perf:` | PATCH | 0.4.0 → 0.4.1 |
| `feat:` | MINOR | 0.4.0 → 0.5.0 |
| `feat!:` or `BREAKING CHANGE:` | MAJOR | 0.4.0 → 1.0.0 |
| `docs:`, `chore:`, `test:`, `style:`, `refactor:` | No release | - |

**Multiple commits**: When releasing, semantic-release analyzes all commits since the last tag and applies the highest applicable bump.

Example:
```
v0.4.0 (last release)
├── fix: correct validation        → would be PATCH
├── feat: add new decorator        → would be MINOR (higher)
└── fix: another bug fix           → would be PATCH

Result: 0.4.0 → 0.5.0 (MINOR wins)
```

## Pre-release Identifiers

Pre-release versions are denoted by a hyphen and a label after the patch number:

- `-alpha.N`: Early preview, unstable, not feature-complete
- `-beta.N`: Feature-complete, but may contain known issues
- `-rc.N`: Release candidate, stable unless critical bugs are found

**Examples:**

- `1.2.0-alpha.1`
- `1.2.0-beta.2`
- `1.2.0-rc.1`
- `1.2.0` (final release)

## Release Flow

### Standard Release

1. **Development**: Merge features and fixes to `main` via PRs
2. **Accumulate**: Commits build up (no automatic release)
3. **Trigger**: Go to **GitHub Actions → Release → Run workflow**
4. **Automatic**: semantic-release handles everything:
   - Analyzes commits since last tag
   - Calculates appropriate version bump
   - Updates `package.json`
   - Generates/updates `CHANGELOG.md`
   - Creates git tag (e.g., `v0.5.0`)
   - Creates GitHub Release with notes
   - Publishes to npm with `@latest` tag

### Pre-releases

For early testing before a stable release:

1. **Create branch**: `git checkout -b beta` (or `alpha`, `rc`)
2. **Push**: `git push origin beta`
3. **Automatic publish**: Each push triggers a pre-release
   - First push: `0.5.0-beta.1`
   - Second push: `0.5.0-beta.2`
   - etc.
4. **Promote to stable**: Merge to `main` and trigger release workflow

**Typical progression:**
```
main → alpha (0.5.0-alpha.1, alpha.2) → beta (0.5.0-beta.1) → rc (0.5.0-rc.1) → main (0.5.0)
```

## Automation with semantic-release

All versioning and publishing is automated via **semantic-release**:

| Task | Automated? |
|------|------------|
| Version calculation | Yes - from commit messages |
| package.json update | Yes |
| CHANGELOG.md generation | Yes |
| Git tag creation | Yes |
| GitHub Release creation | Yes |
| npm publishing | Yes |
| npm tag assignment | Yes |

**Configuration**: See `.releaserc.js` for semantic-release configuration.

## npm Tags

npm tags are assigned automatically based on the release type:

| Branch | npm Tag | Example Installation |
|--------|---------|---------------------|
| `main` | `latest` | `npm install @nestjs-mcp/server` |
| `alpha` | `alpha` | `npm install @nestjs-mcp/server@alpha` |
| `beta` | `beta` | `npm install @nestjs-mcp/server@beta` |
| `rc` | `rc` | `npm install @nestjs-mcp/server@rc` |

## Best Practices

1. **Use conventional commits**: Version bumps depend on commit message format
2. **Breaking changes**: Always use `feat!:` or include `BREAKING CHANGE:` in footer
3. **Test before release**: Run `--dry-run` option in the release workflow to preview
4. **Pre-release for risky changes**: Use alpha/beta branches for significant changes
5. **Document breaking changes**: The CHANGELOG will include them automatically

---

**This document should be used in conjunction with GIT_GUIDELINES.md for a complete understanding of the release and versioning process.**
