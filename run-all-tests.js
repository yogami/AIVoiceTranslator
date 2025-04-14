/**
 * Test Runner for Benedictaitor
 * 
 * This script runs all the tests for the Benedictaitor application:
 * 1. Real End-to-End Test - Tests the actual server implementation with real audio data
 * 2. Comprehensive End-to-End Test - Tests the entire application flow with mocked components
 * 3. Speech Integration Test - Tests the real-time speech transcription functionality
 * 4. Simple Tests - Tests various utility functions
 * 5. WebSocket Tests - Tests WebSocket client communication
 */

import { execSync } from 'child_process';

console.log('=============================================================');
console.log('🎤 BENEDICTAITOR TEST SUITE RUNNER 🎤');
console.log('=============================================================');

const tests = [
  {
    name: 'Real End-to-End Test',
    command: 'node real-e2e-test.js',
    description: 'Tests the actual server implementation with real audio data'
  },
  {
    name: 'Comprehensive End-to-End Test',
    command: 'node comprehensive-e2e-test.js',
    description: 'Tests the entire application flow with mocked components including translations'
  },
  {
    name: 'Speech Integration Test',
    command: 'node speech-integration-test.js',
    description: 'Tests the full speech-to-text workflow with WebSocket communication'
  },
  {
    name: 'Simple Utility Tests',
    command: 'node run-simple-tests.js',
    description: 'Tests the utility functions for formatting and language tools'
  },
  {
    name: 'WebSocket Client Tests',
    command: 'node run-websocket-tests.js',
    description: 'Tests the WebSocket client implementation'
  }
];

// Run each test and collect results
const results = [];

for (const test of tests) {
  console.log(`\n\n-----------------------------------------`);
  console.log(`Running ${test.name}...`);
  console.log(`Description: ${test.description}`);
  console.log(`-----------------------------------------`);
  
  let passed = false;
  try {
    execSync(test.command, { stdio: 'inherit' });
    passed = true;
    console.log(`\n✅ ${test.name} PASSED`);
  } catch (error) {
    passed = false;
    console.log(`\n❌ ${test.name} FAILED`);
  }
  
  results.push({ ...test, passed });
}

// Show summary
console.log('\n\n=============================================================');
console.log('TEST SUMMARY');
console.log('=============================================================');

const passedTests = results.filter(test => test.passed);
const failedTests = results.filter(test => !test.passed);

console.log(`Total Tests: ${results.length}`);
console.log(`Passed: ${passedTests.length}`);
console.log(`Failed: ${failedTests.length}`);

if (failedTests.length > 0) {
  console.log('\nFailed Tests:');
  failedTests.forEach(test => {
    console.log(`- ${test.name}`);
  });
}

console.log('\n=============================================================');
console.log(`Overall Status: ${failedTests.length === 0 ? '✅ PASSED' : '❌ FAILED'}`);
console.log('=============================================================');

// Exit with appropriate code
process.exit(failedTests.length === 0 ? 0 : 1);