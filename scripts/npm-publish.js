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
const VERSION_REGEX = /^(\d+)\.(\d+)\.(\d+)(?:-(alpha|beta|rc)\.(\d+))?$/;

function getPackageJson() {
  const pkgPath = path.resolve(process.cwd(), 'package.json');
  if (!fs.existsSync(pkgPath)) {
    console.error('Error: package.json not found.');
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
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

function parseArgs() {
  const args = process.argv.slice(2);
  const params = {};
  args.forEach(arg => {
    if (arg.startsWith('--tag=')) {
      params.tag = arg.replace('--tag=', '');
    } else if (arg === '--no-dry-run') {
      params.noDryRun = true;
    }
  });
  return params;
}

function validateTag(tag) {
  // Must start with 'v' and follow semver, e.g. v1.2.3, v1.2.3-alpha.0
  const valid = /^v\d+\.\d+\.\d+(-[a-z]+\.\d+)?$/.test(tag);
  if (!valid) {
    console.error(`Error: Tag '${tag}' does not match required pattern: vX.Y.Z[-stage.N]`);
    process.exit(1);
  }
}

function extractVersionFromTag(tag) {
  return tag.startsWith('v') ? tag.slice(1) : tag;
}

function validateSemver(version) {
  // Accepts: 1.2.3, 1.2.3-alpha.0, 1.2.3-beta.1, 1.2.3-rc.2
  const valid = /^\d+\.\d+\.\d+(-[a-z]+\.\d+)?$/.test(version);
  if (!valid) {
    console.error(`Error: Version '${version}' does not match semver pattern: X.Y.Z[-stage.N]`);
    process.exit(1);
  }
}

function main() {
  const { tag, noDryRun } = parseArgs();
  if (!tag) {
    console.error('Usage: node scripts/npm-publish.js --tag=vX.Y.Z[-stage.N] [--no-dry-run]');
    process.exit(1);
  }
  validateTag(tag);
  const version = extractVersionFromTag(tag);
  validateSemver(version);

  const pkg = getPackageJson();
  checkNpmAuth();
  checkBuildSuccess();
  checkNpmVersion(version);

  let publishCmd = 'npm publish';
  const isDryRun = !noDryRun && process.env.CI !== 'true';
  if (isDryRun) {
    publishCmd += ' --dry-run --no-git-checks';
  }
  // Set npm tag if pre-release, else use latest
  const preReleaseMatch = version.match(/-(alpha|beta|rc)\./);

  if (preReleaseMatch) {
    publishCmd += ` --tag ${preReleaseMatch[1]} --access=public`;
  } else {
    publishCmd += ' --tag latest --access=public';
  }

  console.log(`\nPublishing version ${version} from tag ${tag}...\n`);

  if (isDryRun) {
    console.log('Dry run enabled by default: No package will actually be published. Use --no-dry-run or set CI=true to publish for real.');
  }
  run(publishCmd);
}

main();
