#!/usr/bin/env node

/**
 * npm-publish.js
 *
 * Smart publish script for MCP Server packages.
 * - Detects branch and version
 * - Enforces branch and versioning rules
 * - Decides release type (alpha, beta, rc, release)
 * - Runs build and appropriate publish command
 * - Prints clear errors and exits non-zero on rule violation
 *
 * Usage: pnpm run publish
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// --- CONFIGURABLE RULES ---
const ALLOWED_BRANCHES = [/^release\//, /^fix\//];
const RELEASE_BRANCH = /^release\//;
const VERSION_REGEX = /^(\d+)\.(\d+)\.(\d+)(?:-(alpha|beta|rc)\.(\d+))?$/;

function getCurrentBranch() {
  try {
    return execSync('git rev-parse --abbrev-ref HEAD').toString().trim();
  } catch (e) {
    console.error('Error: Not a git repository or git not installed.');
    process.exit(1);
  }
}

function getPackageJson() {
  const pkgPath = path.resolve(process.cwd(), 'package.json');
  if (!fs.existsSync(pkgPath)) {
    console.error('Error: package.json not found.');
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
}

function getReleaseType(version) {
  const match = VERSION_REGEX.exec(version);
  if (!match) return null;
  return match[4] || 'release';
}

function checkAllowedBranch(branch) {
  return ALLOWED_BRANCHES.some((re) => re.test(branch));
}

function checkReleaseBranch(branch) {
  return RELEASE_BRANCH.test(branch);
}

function run(cmd, opts = {}) {
  try {
    execSync(cmd, { stdio: 'inherit', ...opts });
  } catch (e) {
    process.exit(e.status || 1);
  }
}

function checkNpmAuth() {
  try {
    execSync('npm whoami', { stdio: 'ignore' });
  } catch (e) {
    console.error('Error: You are not authenticated with npm. Run `npm login` and try again.');
    process.exit(1);
  }
}

function checkBuildSuccess() {
  const distPath = path.resolve(process.cwd(), 'dist');
  if (!fs.existsSync(distPath) || fs.readdirSync(distPath).length === 0) {
    console.error('Error: Build failed or dist/ directory is empty. Aborting publish.');
    process.exit(1);
  }
}

function checkNpmVersion(version) {
  try {
    const pkg = getPackageJson();
    const name = pkg.name;
    // Get all versions from npm
    const result = execSync(`npm view ${name} versions --json`).toString();
    const versions = JSON.parse(result);
    if (versions.includes(version)) {
      console.error(`Error: Version ${version} already exists on npm. Bump the version before publishing.`);
      process.exit(1);
    }
  } catch (e) {
    // If the package is not published yet, ignore
    if (e.stderr && e.stderr.toString().includes('E404')) return;
    console.error('Error checking npm registry:', e.message || e);
    process.exit(1);
  }
}

function getTagVersion() {
  // Try to get tag from environment (e.g., GITHUB_REF) or from git
  const envTag = process.env.GITHUB_REF;
  if (envTag && envTag.startsWith('refs/tags/v')) {
    return envTag.replace('refs/tags/v', '');
  }
  // Fallback: try to get latest tag from git
  try {
    const tag = execSync('git describe --tags --abbrev=0').toString().trim();
    return tag.startsWith('v') ? tag.slice(1) : tag;
  } catch (e) {
    return null;
  }
}

function getSemverMain(version) {
  // Extracts major.minor.patch
  const match = version.match(/^(\d+)\.(\d+)\.(\d+)/);
  return match ? match[0] : null;
}

function validateTagStructure(tagVersion) {
  // Accepts: 1.2.3, 1.2.3-alpha.0, 1.2.3-beta.1, 1.2.3-rc.2
  const valid = /^\d+\.\d+\.\d+(-((alpha|beta|rc)\.(\d+)))?$/.test(tagVersion);
  if (!valid) {
    console.error(`Error: Tag version '${tagVersion}' does not match the required pattern: v<semver>[-<prerelease>.<number>]`);
    process.exit(1);
  }
}

function isProductiveTag(tagVersion) {
  // Returns true if tag is X.Y.Z (no pre-release)
  return /^\d+\.\d+\.\d+$/.test(tagVersion);
}

function getNpmTagFromVersion(version) {
  // Extracts prerelease part (e.g., alpha.0, beta.1, rc.2) or returns 'latest' for final
  const match = version.match(/^\d+\.\d+\.\d+-(alpha|beta|rc)\.(\d+)$/);
  if (match) {
    return `${match[1]}.${match[2]}`;
  }
  return 'latest';
}

function getNextPrereleaseTag(baseVersion, type) {
  // Find all tags for this version and type, return next incremental tag
  const tagPrefix = `v${baseVersion}-${type}.`;
  let maxNum = -1;
  try {
    const allTags = execSync('git tag', { encoding: 'utf8' })
      .split('\n')
      .filter(Boolean);
    allTags.forEach(tag => {
      if (tag.startsWith(tagPrefix)) {
        const match = tag.match(new RegExp(`^v${baseVersion}-${type}\.(\\d+)$`));
        if (match) {
          const num = parseInt(match[1], 10);
          if (num > maxNum) maxNum = num;
        }
      }
    });
  } catch (e) {
    // ignore
  }
  return `v${baseVersion}-${type}.${maxNum + 1}`;
}

function validateBaseTagFormat(tag) {
  // Must be vX.Y.Z
  if (!/^v\d+\.\d+\.\d+$/.test(tag)) {
    console.error('Error: Tag must be in the format vX.Y.Z (e.g., v0.1.0)');
    process.exit(1);
  }
}

function checkNpmTagExists(pkgName, version) {
  try {
    const result = execSync(`npm view ${pkgName} versions --json`).toString();
    const versions = JSON.parse(result);
    if (versions.includes(version)) {
      console.error(`Error: Version ${version} already exists on npm.`);
      process.exit(1);
    }
  } catch (e) {
    // If the package is not published yet, ignore
    if (e.stderr && e.stderr.toString().includes('E404')) return;
    console.error('Error checking npm registry:', e.message || e);
    process.exit(1);
  }
}

if (process.argv[2] === 'next-tag') {
  // Usage: node scripts/npm-publish.js next-tag v0.1.0 beta
  const baseTag = process.argv[3];
  const type = process.argv[4];
  validateBaseTagFormat(baseTag);
  const baseVersion = baseTag.slice(1); // remove 'v'
  if (!type || !['alpha', 'beta', 'rc'].includes(type)) {
    console.error('Usage: node scripts/npm-publish.js next-tag vX.Y.Z <alpha|beta|rc>');
    process.exit(1);
  }
  if (process.env.CI === 'true') {
    // In CI, just return the base version and check npm
    const pkg = getPackageJson();
    checkNpmTagExists(pkg.name, baseVersion);
    console.log(baseVersion);
    process.exit(0);
  }
  // Local: suggest next pre-release tag
  const nextTag = getNextPrereleaseTag(baseVersion, type);
  console.log(nextTag);
  process.exit(0);
}

function main() {
  if (process.argv[2] === 'next-tag') {
    // Usage: node scripts/npm-publish.js next-tag 0.1.0 alpha
    const baseVersion = process.argv[3];
    const type = process.argv[4];
    if (!baseVersion || !type || !['alpha', 'beta', 'rc'].includes(type)) {
      console.error('Usage: node scripts/npm-publish.js next-tag <baseVersion> <alpha|beta|rc>');
      process.exit(1);
    }
    const nextTag = getNextPrereleaseTag(baseVersion, type);
    console.log(nextTag);
    process.exit(0);
  }

  const branch = getCurrentBranch();
  const pkg = getPackageJson();
  const version = pkg.version;
  const releaseType = getReleaseType(version);

  // --- Tag version validation (if running from a tag) ---
  const tagVersion = getTagVersion();
  if (tagVersion) {
    validateTagStructure(tagVersion);
    const tagSemver = getSemverMain(tagVersion);
    const pkgSemver = getSemverMain(version);
    if (tagSemver !== pkgSemver) {
      console.error(`Error: Tag semver (${tagSemver}) does not match package.json semver (${pkgSemver}).`);
      process.exit(1);
    }
  }

  // Default to dry-run unless --no-dry-run is passed or CI is true
  const isDryRun = !process.argv.includes('--no-dry-run') && process.env.CI !== 'true';

  // --- Branch validation ---
  if (!checkAllowedBranch(branch)) {
    console.error(`\nError: Publishing is only allowed from release/* or fix/* branches. Current: ${branch}`);
    process.exit(1);
  }

  // --- NPM authentication check ---
  checkNpmAuth();

  // --- Build before publish ---
  run('pnpm run build');
  checkBuildSuccess();

  // --- NPM version check ---
  checkNpmVersion(version);

  // --- Restrict final releases to CI/CD only ---
  if (releaseType === 'release' && process.env.CI !== 'true') {
    console.error('Error: Final releases can only be published from CI/CD pipelines. Set CI=true in your environment.');
    process.exit(1);
  }

  // --- Decide publish command ---
  let publishCmd = 'npm publish';
  if (isDryRun) {
    publishCmd += ' --dry-run --no-git-checks';
  }
  const npmTag = getNpmTagFromVersion(version);
  if (npmTag !== 'latest') {
    publishCmd += ` --tag ${npmTag}`;
    // For alpha/beta/rc, set access (alpha is restricted, others are public)
    if (npmTag.startsWith('alpha')) {
      publishCmd += ' --access=restricted';
    } else {
      publishCmd += ' --access=public';
    }
  } else {
    if (!checkReleaseBranch(branch)) {
      console.error('Error: Final releases can only be published from release/* branches.');
      process.exit(1);
    }
    publishCmd += ' --access=public';
  }

  // --- Publish ---
  console.log(`\nPublishing version ${version} as ${npmTag} from branch ${branch}...\n`);
  if (isDryRun) {
    console.log('Dry run enabled by default: No package will actually be published. Use --no-dry-run or set CI=true to publish for real.');
  }
  run(publishCmd);
}

main();
