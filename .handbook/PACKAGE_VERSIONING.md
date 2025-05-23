# Package Versioning Guidelines <!-- omit in toc -->

> For all Git branching and pull request rules, see GIT_GUIDELINES.md. This document focuses exclusively on versioning, tagging, and publishing policies.

This document describes the versioning policy and release process for all packages in the MCP Server NestJS module library. Its objective is to ensure clear, progressive, and predictable versioning for all releases, maintain compatibility with the @modelcontextprotocol/sdk, and provide guidance for stable and pre-release workflows. Use this guide to understand how to version, tag, and publish packages in this project.

## Table of Contents <!-- omit in toc -->

- [Overview](#overview)
- [Version Format](#version-format)
- [Pre-release Identifiers](#pre-release-identifiers)
- [Tagging and Publishing](#tagging-and-publishing)
- [Progressive Versioning](#progressive-versioning)
- [Version Progression Validation](#version-progression-validation)
- [Release Flow](#release-flow)
- [Automation](#automation)
- [Best Practices](#best-practices)
- [Publication Policy](#publication-policy)

## Overview

This document defines the versioning strategy for all packages in this repository. The goal is to ensure clear, progressive, and predictable versioning for all releases, including pre-releases and stable versions.

## Version Format

We follow [Semantic Versioning 2.0.0](https://semver.org/) as the baseline:

```
MAJOR.MINOR.PATCH[-PRERELEASE]
```

- **MAJOR**: Incompatible API changes
- **MINOR**: Backwards-compatible functionality
- **PATCH**: Backwards-compatible bug fixes
- **PRERELEASE**: Optional, for alpha/beta/rc versions

## Pre-release Identifiers

Pre-release versions are denoted by a hyphen and a label after the patch number:

- `-alpha`: Early preview, unstable, not feature-complete
- `-beta`: Feature-complete, but may contain known issues
- `-rc`: Release candidate, stable unless critical bugs are found

**Examples:**

- `1.2.0-alpha.1`
- `1.2.0-beta.2`
- `1.2.0-rc.1`
- `1.2.0` (final release)

## Tagging and Publishing

The version field in `package.json` (package version) must strictly follow the format: `X.Y.Z` or `X.Y.Z-prerelease` (e.g., `1.2.3`, `1.2.3-beta.1`). The version must never include a `v` prefix.

- **Stable releases**: package version as `X.Y.Z`.
- **Pre-releases**: package version as `X.Y.Z-prerelease.N` (e.g., `1.2.3-beta.1`).

## Progressive Versioning

- **Version numbers must always increase** with each release, regardless of branch.
- **All new versions MUST be strictly greater than previous versions.**
- **Never publish a version that is equal to or less than an existing version.**
- This ensures consumers always receive the latest, most appropriate version and avoids confusion or accidental downgrades.

## Version Progression Validation

All new versions MUST be strictly greater than previous versions. This is enforced automatically by CI/CD:

- For pull requests from `release/*` or `hotfix/*` branches targeting `main`, the workflow checks that the version in the PR is strictly greater than the version in `main`.
- If the version is not progressive, the PR will be rejected and must be corrected before merging.
- This prevents accidental downgrades or duplicate versions in production.

## Release Flow

The complete release process is as follows:

1. Prepare a `release/*` or `hotfix/*` branch with the new version in `package.json`.
2. Create a PR to `main`. The CI will validate version progression and run tests.
3. Once merged, the CI workflow will create a tag on `main`.
4. The publish workflow will build and publish the package to NPM, assigning the correct NPM tag.
5. An automated PR will sync `main` to `develop` to keep branches aligned.

> Always ensure the version is bumped before creating the PR to `main`.

## Automation

- CI/CD workflows will:
  - Validate that new versions are strictly progressive.
  - Tag releases according to the pre-release identifier.
  - Prevent publishing if the version is not greater than the previous.

## Best Practices

- Bump the version as soon as a change is made that warrants it.
- Use pre-release identifiers for unstable or preview releases.
- Only remove the pre-release identifier (`-alpha`, `-beta`, `-rc`) when the release is considered stable.
- Document breaking changes and version bumps in the changelog.

## Publication Policy

This project follows [Semantic Versioning 2.0.0](https://semver.org/). All releases must:

- Use strictly increasing version numbers (no downgrades or duplicates)
- Use pre-release identifiers (`-alpha`, `-beta`, `-rc`) for unstable or preview releases
- Only remove the pre-release identifier when the release is considered stable
- Document breaking changes and version bumps in the changelog

---

**This document should be used in conjunction with GIT_GUIDELINES.md for a complete understanding of the release and versioning process.**
