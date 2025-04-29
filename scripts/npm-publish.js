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

function main() {
  const branch = getCurrentBranch();
  const pkg = getPackageJson();
  const version = pkg.version;
  const releaseType = getReleaseType(version);

  // Default to dry-run unless --no-dry-run is passed or CI is true
  const isDryRun = !process.argv.includes('--no-dry-run') && process.env.CI !== 'true';

  // --- Branch validation ---
  if (!checkAllowedBranch(branch)) {
    console.error(`\nError: Publishing is only allowed from release/* or fix/* branches. Current: ${branch}`);
    process.exit(1);
  }

  // --- Version validation ---
  run('npx -y check-pkg-updated');

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
    console.log('Dry run enabled by default: No package will actually be published. Use --no-dry-run or set CI=true to publish for real.');
  }
  run(publishCmd);
}

main();
