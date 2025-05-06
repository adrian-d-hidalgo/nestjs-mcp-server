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