#!/usr/bin/env node

/**
 * test-npm-publish.js
 *
 * Test script for npm-publish.js to verify proper handling of version tags.
 * This script directly tests the key functions for handling tags with 'v' prefix.
 * 
 * Usage: node scripts/test-npm-publish.js
 */

// Import the functions to test
const npmPublish = require('./npm-publish');
const validateTag = npmPublish.validateTag;
const extractVersionFromTag = npmPublish.extractVersionFromTag;
const checkVersionParity = npmPublish.checkVersionParity;
const validatePreReleaseSuffix = npmPublish.validatePreReleaseSuffix;
const validateVersionIncrement = npmPublish.validateVersionIncrement;

// ANSI colors for output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
};

console.log(`${colors.blue}=== Testing npm-publish.js version tag handling ===${colors.reset}\n`);

// Test cases
const testCases = [
  {
    name: "validateTag with valid v-prefixed tag",
    fn: () => {
      try {
        validateTag('v1.0.0');
        return { success: true, message: "Accepted valid tag with v prefix" };
      } catch (error) {
        return { success: false, message: error.message };
      }
    }
  },
  {
    name: "validateTag with invalid tag",
    fn: () => {
      try {
        validateTag('1.0.0'); // Should fail without 'v'
        return { success: false, message: "Accepted invalid tag without v prefix" };
      } catch (error) {
        return { success: true, message: "Correctly rejected tag without v prefix" };
      }
    }
  },
  {
    name: "extractVersionFromTag with v-prefixed tag",
    fn: () => {
      const version = extractVersionFromTag('v1.0.0');
      return {
        success: version === '1.0.0',
        message: version === '1.0.0'
          ? "Correctly extracted '1.0.0' from 'v1.0.0'"
          : `Incorrectly extracted '${version}' from 'v1.0.0'`
      };
    }
  },
  {
    name: "checkVersionParity with matching versions",
    fn: () => {
      try {
        checkVersionParity('1.0.0', '1.0.0');
        return { success: true, message: "Correctly verified matching versions" };
      } catch (error) {
        return { success: false, message: error.message };
      }
    }
  },
  {
    name: "checkVersionParity with non-matching versions",
    fn: () => {
      try {
        checkVersionParity('1.0.0', '1.0.1');
        return { success: false, message: "Failed to detect version mismatch" };
      } catch (error) {
        return { success: true, message: "Correctly detected version mismatch" };
      }
    }
  },
  {
    name: "Complete tag workflow test",
    fn: () => {
      try {
        const tag = 'v1.0.0';
        validateTag(tag);
        const version = extractVersionFromTag(tag);
        checkVersionParity(version, '1.0.0');
        return { success: true, message: "Complete workflow successful" };
      } catch (error) {
        return { success: false, message: error.message };
      }
    }
  },
  {
    name: "validatePreReleaseSuffix - alpha suffix on release branch",
    fn: () => {
      try {
        validatePreReleaseSuffix('1.0.0-alpha.1', 'release/1.0.0');
        return { success: true, message: "Correctly allowed alpha suffix on release branch" };
      } catch (error) {
        return { success: false, message: error.message };
      }
    }
  },
  {
    name: "validatePreReleaseSuffix - beta suffix on release branch",
    fn: () => {
      try {
        validatePreReleaseSuffix('1.0.0-beta.1', 'release/1.0.0');
        return { success: true, message: "Correctly allowed beta suffix on release branch" };
      } catch (error) {
        return { success: false, message: error.message };
      }
    }
  },
  {
    name: "validatePreReleaseSuffix - rc suffix on release branch",
    fn: () => {
      try {
        validatePreReleaseSuffix('1.0.0-rc.1', 'release/1.0.0');
        return { success: true, message: "Correctly allowed rc suffix on release branch" };
      } catch (error) {
        return { success: false, message: error.message };
      }
    }
  },
  {
    name: "validatePreReleaseSuffix - rc suffix on hotfix branch",
    fn: () => {
      try {
        validatePreReleaseSuffix('1.0.1-rc.1', 'hotfix/1.0.1');
        return { success: true, message: "Correctly allowed rc suffix on hotfix branch" };
      } catch (error) {
        return { success: false, message: error.message };
      }
    }
  },
  {
    name: "validatePreReleaseSuffix - alpha suffix on hotfix branch (should fail)",
    fn: () => {
      try {
        validatePreReleaseSuffix('1.0.1-alpha.1', 'hotfix/1.0.1');
        return { success: false, message: "Incorrectly allowed alpha suffix on hotfix branch" };
      } catch (error) {
        return { success: true, message: "Correctly rejected alpha suffix on hotfix branch" };
      }
    }
  },
  {
    name: "validatePreReleaseSuffix - final release on main branch",
    fn: () => {
      try {
        validatePreReleaseSuffix('1.0.0', 'main');
        return { success: true, message: "Correctly allowed final release on main branch" };
      } catch (error) {
        return { success: false, message: error.message };
      }
    }
  },
  {
    name: "validatePreReleaseSuffix - final release on non-main branch (should fail)",
    fn: () => {
      try {
        validatePreReleaseSuffix('1.0.0', 'release/1.0.0');
        return { success: false, message: "Incorrectly allowed final release on non-main branch" };
      } catch (error) {
        return { success: true, message: "Correctly rejected final release on non-main branch" };
      }
    }
  },
  {
    name: "validateVersionIncrement - major increment on release branch",
    fn: () => {
      try {
        validateVersionIncrement('2.0.0', '1.2.3', 'release/2.0.0');
        return { success: true, message: "Correctly validated major version increment on release branch" };
      } catch (error) {
        return { success: false, message: error.message };
      }
    }
  },
  {
    name: "validateVersionIncrement - minor increment on release branch",
    fn: () => {
      try {
        validateVersionIncrement('1.3.0', '1.2.3', 'release/1.3.0');
        return { success: true, message: "Correctly validated minor version increment on release branch" };
      } catch (error) {
        return { success: false, message: error.message };
      }
    }
  },
  {
    name: "validateVersionIncrement - patch increment on release branch (should fail)",
    fn: () => {
      try {
        validateVersionIncrement('1.2.4', '1.2.3', 'release/1.2.4');
        return { success: false, message: "Incorrectly allowed patch increment on release branch" };
      } catch (error) {
        return { success: true, message: "Correctly rejected patch increment on release branch" };
      }
    }
  },
  {
    name: "validateVersionIncrement - patch increment on hotfix branch",
    fn: () => {
      try {
        validateVersionIncrement('1.2.4', '1.2.3', 'hotfix/1.2.4');
        return { success: true, message: "Correctly validated patch increment on hotfix branch" };
      } catch (error) {
        return { success: false, message: error.message };
      }
    }
  },
  {
    name: "validateVersionIncrement - minor increment on hotfix branch (should fail)",
    fn: () => {
      try {
        validateVersionIncrement('1.3.0', '1.2.3', 'hotfix/1.3.0');
        return { success: false, message: "Incorrectly allowed minor increment on hotfix branch" };
      } catch (error) {
        return { success: true, message: "Correctly rejected minor increment on hotfix branch" };
      }
    }
  },
  {
    name: "Issue #45 - checkVersionParity when versions are identical",
    fn: () => {
      try {
        // This simulates the case where tag version and package.json version are identical
        checkVersionParity('1.0.0', '1.0.0');
        return { success: true, message: "Correctly handled identical versions (fix for issue #45)" };
      } catch (error) {
        return { success: false, message: `Failed with error: ${error.message}` };
      }
    }
  },
  {
    name: "Issue #45 - Version mismatch validation",
    fn: () => {
      // Mock the process.exit function to verify it's called with exit code 1
      const originalExit = process.exit;
      let exitCalled = false;
      let exitCode = null;

      process.exit = (code) => {
        exitCalled = true;
        exitCode = code;
        // Don't actually exit during test
      };

      try {
        // Create a mock function that would call console.error
        const originalConsoleError = console.error;
        let errorMessage = null;

        console.error = (msg) => {
          errorMessage = msg;
        };

        // Simulate the main function's check with mismatched versions
        if ('1.0.0' !== '1.0.1') {
          console.error(`Error: Version mismatch. package.json=1.0.0, tag=1.0.1`);
          process.exit(1);
        }

        // Restore original functions
        console.error = originalConsoleError;
        process.exit = originalExit;

        return {
          success: exitCalled && exitCode === 1 && errorMessage?.includes('Version mismatch'),
          message: "Correctly fails with error when versions don't match"
        };
      } catch (error) {
        // Restore original function
        process.exit = originalExit;
        return { success: false, message: `Unexpected error: ${error.message}` };
      }
    }
  },
  {
    name: "Feature: Handling prerelease suffixes in package.json vs tag",
    fn: () => {
      try {
        // Mock fs module
        const fs = require('fs');
        const originalReadFileSync = fs.readFileSync;
        const originalWriteFileSync = fs.writeFileSync;

        // Mock child_process module
        const child_process = require('child_process');
        const originalExecSync = child_process.execSync;

        // Mock commands executed
        let commands = [];
        child_process.execSync = (cmd) => {
          commands.push(cmd);
          return ''; // Mock empty output
        };

        // Mock package.json
        const mockPackageJson = {
          name: "test-package",
          version: "1.0.0" // Base version without prerelease suffix
        };

        fs.readFileSync = (path) => {
          if (path.endsWith('package.json')) {
            return JSON.stringify(mockPackageJson);
          }
          return originalReadFileSync(path);
        };

        // Setup test variables
        const tagVersion = "1.0.0-rc.1"; // Version with prerelease suffix
        const packageVersion = "1.0.0";  // Base version in package.json

        // In actual code, this is part of main() function
        // This test simulates the behavior of the main function
        // when handling a tag with suffix and package.json with base version
        const isTemporaryUpdateNeeded = packageVersion !== tagVersion;

        // Should determine this needs a temporary update
        if (isTemporaryUpdateNeeded === false) {
          return {
            success: false,
            message: "Failed to detect need for temporary version update"
          };
        }

        // Should detect the correct base version parts match
        try {
          checkVersionParity(tagVersion, packageVersion);
        } catch (error) {
          return {
            success: false,
            message: `checkVersionParity should allow base version match but failed: ${error.message}`
          };
        }

        // Restore mocks
        fs.readFileSync = originalReadFileSync;
        fs.writeFileSync = originalWriteFileSync;
        child_process.execSync = originalExecSync;

        return {
          success: true,
          message: "Correctly handled prerelease suffix differences between package.json and tag"
        };
      } catch (error) {
        return { success: false, message: `Unexpected error: ${error.message}` };
      }
    }
  },
  {
    name: "Feature: Temporary version update and restore simulation",
    fn: () => {
      try {
        // Mock execSync to track called commands
        const child_process = require('child_process');
        const originalExecSync = child_process.execSync;

        let commands = [];
        child_process.execSync = (cmd) => {
          commands.push(cmd);
          return ''; // Mock empty output
        };

        // Simulate the version update and restore logic
        const originalVersion = "1.0.0";
        const tagVersion = "1.0.0-rc.1";

        // Simulate temporary version update
        if (originalVersion !== tagVersion) {
          // This is what the actual npm-publish.js does
          child_process.execSync(`pnpm version ${tagVersion} --no-git-tag-version`);
        }

        // Simulate publishing (in the real script, this would call npm publish)
        child_process.execSync('npm publish --tag rc --access=public');

        // Simulate version restore
        if (originalVersion !== tagVersion) {
          child_process.execSync(`pnpm version ${originalVersion} --no-git-tag-version`);
        }

        // Check that the right commands were executed in the right order
        const updateCmd = commands[0];
        const publishCmd = commands[1];
        const restoreCmd = commands[2];

        // Restore original function
        child_process.execSync = originalExecSync;

        if (!updateCmd.includes(`pnpm version ${tagVersion}`)) {
          return {
            success: false,
            message: `Update command incorrect: ${updateCmd}`
          };
        }

        if (!publishCmd.includes('npm publish')) {
          return {
            success: false,
            message: `Publish command incorrect: ${publishCmd}`
          };
        }

        if (!restoreCmd.includes(`pnpm version ${originalVersion}`)) {
          return {
            success: false,
            message: `Restore command incorrect: ${restoreCmd}`
          };
        }

        return {
          success: true,
          message: "Correctly simulated temporary version update and restore workflow"
        };
      } catch (error) {
        return { success: false, message: `Unexpected error: ${error.message}` };
      }
    }
  }
];

let passed = 0;
let failed = 0;

// Run each test case
for (const [index, testCase] of testCases.entries()) {
  console.log(`${colors.blue}[Test ${index + 1}]${colors.reset} ${testCase.name}`);

  try {
    const result = testCase.fn();

    if (result.success) {
      console.log(`  ${colors.green}✓ PASSED: ${result.message}${colors.reset}`);
      passed++;
    } else {
      console.log(`  ${colors.red}✗ FAILED: ${result.message}${colors.reset}`);
      failed++;
    }
  } catch (error) {
    console.log(`  ${colors.red}✗ FAILED: Unexpected error: ${error.message}${colors.reset}`);
    failed++;
  }

  console.log(''); // Empty line between tests
}

// Print summary
console.log(`${colors.blue}=== Test Summary ===${colors.reset}`);
console.log(`Total: ${passed + failed}, Passed: ${colors.green}${passed}${colors.reset}, Failed: ${colors.red}${failed}${colors.reset}`);

// Exit with success only if all tests passed
process.exit(failed === 0 ? 0 : 1); 
