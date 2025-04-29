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

function main() {
  const branch = getCurrentBranch();
  const pkg = getPackageJson();
  const version = pkg.version;
  const releaseType = getReleaseType(version);

  // Parse --dry-run flag
  const isDryRun = process.argv.includes('--dry-run');

  // --- Branch validation ---
  if (!checkAllowedBranch(branch)) {
    console.error(`\nError: Publishing is only allowed from release/* or fix/* branches. Current: ${branch}`);
    process.exit(1);
  }

  // --- Version validation ---
  run('pnpm run prepublish:check-version');

  // --- Build before publish ---
  run('pnpm run build');

  // --- Decide publish command ---
  let publishCmd = 'npm publish';
  if (isDryRun) publishCmd += ' --dry-run';
  if (releaseType === 'alpha') {
    publishCmd += ' --access=restricted --tag alpha';
  } else if (releaseType === 'beta') {
    publishCmd += ' --access=public --tag beta';
  } else if (releaseType === 'rc') {
    publishCmd += ' --access=public --tag rc';
  } else if (releaseType === 'release') {
    if (!checkReleaseBranch(branch)) {
      console.error('Error: Final releases can only be published from release/* branches.');
      process.exit(1);
    }
    publishCmd += ' --access=public';
  } else {
    console.error(`Error: Unknown or invalid version format: ${version}`);
    process.exit(1);
  }

  // --- Publish ---
  console.log(`\nPublishing version ${version} as ${releaseType} from branch ${branch}...\n`);
  if (isDryRun) {
    console.log('Dry run enabled: No package will actually be published.');
  }
  run(publishCmd);
}

main();
