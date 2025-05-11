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
    throw new Error(`Tag '${tag}' does not match required pattern: vX.Y.Z[-stage.N]`);
  }
}

function extractVersionFromTag(tag) {
  // Always remove 'v' prefix if present
  return tag.startsWith('v') ? tag.slice(1) : tag;
}

function validateSemver(version) {
  // Accepts: 1.2.3, 1.2.3-alpha.0, 1.2.3-beta.1, 1.2.3-rc.2
  const valid = /^\d+\.\d+\.\d+(-[a-z]+\.\d+)?$/.test(version);

  if (!valid) {
    console.error(`Error: Version '${version}' does not match semver pattern: X.Y.Z[-stage.N]`);
    throw new Error(`Version '${version}' does not match semver pattern: X.Y.Z[-stage.N]`);
  }
}

/**
 * Checks that the x.y.z part of the tag version matches the x.y.z part of package.json.
 * Throws and exits if they do not match.
 * @param {string} tagVersion - The version string extracted from the tag (e.g., 1.2.3-alpha.0)
 * @param {string} pkgVersion - The version string from package.json (e.g., 1.2.3-alpha.0)
 */
function checkVersionParity(tagVersion, pkgVersion) {
  // Extract x.y.z from both versions
  const tagBase = tagVersion.split('-')[0];
  const pkgBase = pkgVersion.split('-')[0];

  // Log the comparison for debugging
  console.log(`Comparing tag version (${tagBase}) with package.json version (${pkgBase})...`);

  if (tagBase !== pkgBase) {
    console.error(`Error: Version mismatch. Tag version (x.y.z): '${tagBase}' does not match package.json version (x.y.z): '${pkgBase}'.\nPlease update package.json to match the tag version before publishing.`);
    throw new Error(`Version mismatch. Tag version: '${tagBase}' does not match package.json version: '${pkgBase}'`);
  }
}

/**
 * Detects the current branch name from git
 * @returns {string} The current branch name
 */
function getCurrentBranch() {
  try {
    // First try to get branch from standard git command
    const branch = execSync('git rev-parse --abbrev-ref HEAD').toString().trim();

    // In GitHub Actions with tag checkout, we might get 'HEAD' as the branch
    if (branch === 'HEAD') {
      // We're in a detached HEAD state, which happens when checkout a tag

      // Check if we're in GitHub Actions and this is a tag push
      if (process.env.GITHUB_REF && process.env.GITHUB_REF.startsWith('refs/tags/')) {
        const tag = process.env.GITHUB_REF.replace('refs/tags/', '');
        console.log(`Detected tag push in GitHub Actions: ${tag}`);

        // If this is an alpha tag, likely from a release branch
        if (tag.includes('-alpha.')) {
          return 'release/auto-detected';
        }
        // If this is a beta tag, also likely from a release branch
        else if (tag.includes('-beta.')) {
          return 'release/auto-detected';
        }
        // If this is an rc tag, could be from a release or hotfix branch
        else if (tag.includes('-rc.')) {
          // Try to detect if this is a hotfix or release by comparing version numbers
          const version = tag.replace(/^v/, '').split('-')[0];

          try {
            const latestVersion = execSync('npm view . version').toString().trim();
            const [maj, min] = version.split('.');
            const [lMaj, lMin] = latestVersion.split('.');

            if (maj === lMaj && min === lMin) {
              // Same major/minor: treat as hotfix
              return 'hotfix/auto-detected';
            } else {
              // Different major/minor: treat as release
              return 'release/auto-detected';
            }
          } catch (e) {
            // If can't determine, default to release
            return 'release/auto-detected';
          }
        }
        // For regular release tags, we're publishing from main
        else {
          return 'main';
        }
      }

      // Try to detect branch from CI environment variables
      if (process.env.GITHUB_HEAD_REF) {
        return process.env.GITHUB_HEAD_REF;
      }

      console.warn('Warning: In detached HEAD state. Assuming main branch for tag publishing.');
      return 'main'; // Default to main branch for tag publishing
    }

    return branch;
  } catch (e) {
    console.error('Error: Unable to detect current git branch. Make sure you are in a git repository.');
    throw new Error('Unable to detect current git branch');
  }
}

/**
 * Validates that pre-release suffixes are used only on allowed branches
 * @param {string} version - The version string (e.g., 1.2.3-alpha.1)
 * @param {string} branch - The current branch name
 */
function validatePreReleaseSuffix(version, branch) {
  // Check if the version is a pre-release
  const preReleaseMatch = version.match(/-(alpha|beta|rc)\.(\d+)$/);

  if (!preReleaseMatch) {
    // This is a final release (no suffix)
    // Final releases are only allowed from 'main'
    if (branch !== 'main') {
      console.error(`Error: Final releases (without pre-release suffix) are only allowed from 'main' branch. Current branch: ${branch}`);
      throw new Error(`Final releases are only allowed from 'main' branch`);
    }
    return;
  }

  const suffix = preReleaseMatch[1]; // alpha, beta, or rc

  if (branch.startsWith('release/')) {
    // release/* branches allow -alpha.*, -beta.*, -rc.* suffixes
    return;
  } else if (branch === 'release/auto-detected') {
    // Special case for auto-detected release branch from tags
    console.log(`Using auto-detected release branch for tag with ${suffix} suffix`);
    return;
  } else if (branch.startsWith('hotfix/')) {
    // hotfix/* branches only allow -rc.* suffix
    if (suffix !== 'rc') {
      console.error(`Error: Hotfix branches only allow 'rc' pre-release suffix. Found: ${suffix}`);
      throw new Error(`Hotfix branches only allow 'rc' pre-release suffix`);
    }
  } else if (branch === 'main') {
    // main branch allowed any suffix for testing, but normally should have no suffix
    console.warn(`Warning: Publishing a pre-release from 'main' branch. Typically final releases (without suffix) should be published from main.`);
  } else {
    // Other branches are not allowed to publish
    console.error(`Error: Publishing is only allowed from 'main', 'release/*', or 'hotfix/*' branches. Current branch: ${branch}`);
    throw new Error(`Publishing is not allowed from branch ${branch}`);
  }
}

/**
 * Validates semantic version increment based on branch type
 * @param {string} newVersion - The new version string (e.g., 1.2.3)
 * @param {string} oldVersion - The previous version string (e.g., 1.1.0)
 * @param {string} branch - The current branch name
 */
function validateVersionIncrement(newVersion, oldVersion, branch) {
  // Parse versions and remove pre-release suffixes for comparison
  const parseVersion = (v) => {
    const parts = v.split('-')[0].split('.').map(Number);
    return {
      major: parts[0],
      minor: parts[1],
      patch: parts[2]
    };
  };

  const oldVer = parseVersion(oldVersion);
  const newVer = parseVersion(newVersion);

  // For auto-detected branches in CI, use more permissive validation
  if (branch === 'release/auto-detected') {
    // For auto-detected release branches, just check that the version is greater
    if (newVer.major > oldVer.major ||
      (newVer.major === oldVer.major && newVer.minor > oldVer.minor) ||
      (newVer.major === oldVer.major && newVer.minor === oldVer.minor && newVer.patch > oldVer.patch)) {
      console.log(`Auto-detected release branch: Valid version increment from ${oldVersion} to ${newVersion}`);
      return; // Valid increment, any type is allowed
    } else {
      console.error(`Error: Version in auto-detected branch must be greater than previous version. ${oldVersion} → ${newVersion}`);
      throw new Error(`Invalid version increment for auto-detected branch`);
    }
  } else if (branch === 'hotfix/auto-detected') {
    // For auto-detected hotfix branches, only allow patch increment
    if (newVer.major === oldVer.major &&
      newVer.minor === oldVer.minor &&
      newVer.patch > oldVer.patch) {
      console.log(`Auto-detected hotfix branch: Valid patch increment from ${oldVersion} to ${newVersion}`);
      return;
    } else {
      console.error(`Error: Hotfix auto-detected branches should only increment PATCH version. ${oldVersion} → ${newVersion}`);
      throw new Error(`Invalid version increment for hotfix auto-detected branch`);
    }
  } else if (branch.startsWith('release/')) {
    // release/* should increment MAJOR or MINOR
    if (newVer.major > oldVer.major ||
      (newVer.major === oldVer.major && newVer.minor > oldVer.minor)) {
      // Valid increment
      if (newVer.major > oldVer.major) {
        // If MAJOR bumped, MINOR and PATCH should be 0
        if (newVer.minor !== 0 || newVer.patch !== 0) {
          console.warn(`Warning: When incrementing MAJOR version, MINOR and PATCH should be 0. Found ${newVer.major}.${newVer.minor}.${newVer.patch}`);
        }
      } else if (newVer.minor > oldVer.minor) {
        // If MINOR bumped, PATCH should be 0
        if (newVer.patch !== 0) {
          console.warn(`Warning: When incrementing MINOR version, PATCH should be 0. Found ${newVer.major}.${newVer.minor}.${newVer.patch}`);
        }
      }
    } else {
      console.error(`Error: Release branches should increment MAJOR or MINOR version. ${oldVersion} → ${newVersion}`);
      throw new Error(`Invalid version increment for release branch`);
    }
  } else if (branch.startsWith('hotfix/')) {
    // hotfix/* should only increment PATCH
    if (newVer.major === oldVer.major &&
      newVer.minor === oldVer.minor &&
      newVer.patch > oldVer.patch) {
      // Valid increment
    } else {
      console.error(`Error: Hotfix branches should only increment PATCH version. ${oldVersion} → ${newVersion}`);
      throw new Error(`Invalid version increment for hotfix branch`);
    }
  }
}

function main() {
  try {
    const { tag, noDryRun } = parseArgs();

    if (!tag) {
      console.error('Usage: node scripts/npm-publish.js --tag=vX.Y.Z[-stage.N] [--no-dry-run]');
      process.exit(1);
    }

    // Log environment information for debugging
    console.log('Environment:');
    console.log('- Node.js version:', process.version);
    console.log('- Working directory:', process.cwd());
    console.log('- CI environment:', process.env.CI ? 'Yes' : 'No');
    console.log('- GitHub Actions:', process.env.GITHUB_ACTIONS ? 'Yes' : 'No');
    if (process.env.GITHUB_ACTIONS) {
      console.log('- GitHub ref:', process.env.GITHUB_REF || 'Not set');
      console.log('- GitHub head ref:', process.env.GITHUB_HEAD_REF || 'Not set');
      console.log('- GitHub base ref:', process.env.GITHUB_BASE_REF || 'Not set');
    }

    validateTag(tag);
    const version = extractVersionFromTag(tag);
    validateSemver(version);

    const pkg = getPackageJson();
    console.log(`Tag: ${tag}, extracted version: ${version}, package.json version: ${pkg.version}`);

    // Check version parity after extracting the 'v' prefix
    checkVersionParity(version, pkg.version);

    // Detect current branch and validate pre-release suffix
    const branch = getCurrentBranch();
    console.log(`Current branch: ${branch}`);
    validatePreReleaseSuffix(version, branch);

    // Validate version increment if we can get the previous version
    try {
      const latestVersion = execSync('npm view . version').toString().trim();
      if (latestVersion) {
        validateVersionIncrement(version, latestVersion, branch);
        console.log(`Version increment validated: ${latestVersion} → ${version}`);
      }
    } catch (e) {
      // If the package is not published yet, ignore
      if (e.stderr && e.stderr.toString().includes('E404')) {
        console.log('No previous version found. This appears to be the first release.');
      } else {
        console.warn(`Warning: Unable to validate version increment: ${e.message}`);
      }
    }

    checkNpmAuth();
    checkBuildSuccess();
    checkNpmVersion(version);

    // Ensure package.json version matches the tag version (strict validation)
    if (pkg.version !== version) {
      console.error(`Error: Version mismatch. package.json=${pkg.version}, tag=${version}`);
      process.exit(1);
    } else {
      console.log(`Package.json version matches tag version (${version}), continuing...`);
    }

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

    // Rollback package.json to base version (x.y.z) if a pre-release was published
    const publishedBaseVersion = version.split('-')[0];

    if (version !== publishedBaseVersion) {
      run(`pnpm version ${publishedBaseVersion} --no-git-tag-version`);
      console.log(`Rolled back package.json to base version: ${publishedBaseVersion}`);
    }
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

// Export functions for testing
if (require.main !== module) {
  module.exports = {
    validateTag,
    extractVersionFromTag,
    validateSemver,
    checkVersionParity,
    validatePreReleaseSuffix,
    validateVersionIncrement
  };
} else {
  main();
}
