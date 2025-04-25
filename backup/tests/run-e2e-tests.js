/**
 * End-to-End Test Runner for Benedictaitor
 * 
 * This script runs all the end-to-end Selenium tests for the Benedictaitor application.
 * Tests verify:
 * 1. All pages load correctly without errors
 * 2. WebSocket connections can be established
 * 3. Messages can be sent between teacher and student
 * 
 * @requires selenium-webdriver
 * @requires mocha
 * @requires chai
 */

const { spawnSync } = require('child_process');
const path = require('path');

// Check if the server is running
async function checkServerRunning() {
  try {
    const response = await fetch('http://localhost:5000/api/health');
    return response.ok;
  } catch (error) {
    return false;
  }
}

// Run tests with Mocha
function runTests() {
  console.log('Running E2E tests...');
  
  // Run tests with Mocha
  const mochaProcess = spawnSync('npx', [
    'mocha',
    path.join('__tests__', 'e2e', '*.test.js'),
    '--timeout', '60000'
  ], {
    stdio: 'inherit'
  });
  
  return mochaProcess.status === 0;
}

// Main function
async function main() {
  console.log('====================');
  console.log('  E2E TEST RUNNER');
  console.log('====================');
  
  // Ensure server is running
  console.log('Checking if server is running...');
  const serverRunning = await checkServerRunning();
  
  if (!serverRunning) {
    console.error('❌ Server is not running! Start the server first with "npm run dev"');
    process.exit(1);
  }
  
  console.log('✓ Server is running');
  
  // Run tests
  const success = runTests();
  
  if (success) {
    console.log('✅ ALL E2E TESTS PASSED');
  } else {
    console.error('❌ SOME E2E TESTS FAILED');
    process.exit(1);
  }
}

// Run the main function
main().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});