#!/usr/bin/env node

// Quick validation script to check if our specific failing tests are now passing

const { execSync } = require('child_process');

const tests = [
  {
    name: "Session inactivity cleanup test",
    command: "npm test tests/integration/session-lifecycle.test.ts -- --testNamePattern='should clean up sessions inactive for 30\\+ minutes'"
  },
  {
    name: "Teacher-student flow test", 
    command: "npm test tests/integration/services/WebSocketServer.test.ts -- --testNamePattern='should handle complete teacher-student session flow'"
  },
  {
    name: "Settings merge test",
    command: "npm test tests/integration/services/WebSocketServer.test.ts -- --testNamePattern='should merge settings updates'"
  }
];

console.log('🧪 Validating specific test fixes...\n');

for (const test of tests) {
  console.log(`Testing: ${test.name}`);
  console.log(`Command: ${test.command}`);
  
  try {
    const result = execSync(test.command, { 
      stdio: 'pipe', 
      timeout: 60000,
      cwd: '/Users/yamijala/gitprojects/AIVoiceTranslator'
    });
    console.log('✅ PASSED\n');
  } catch (error) {
    console.log('❌ FAILED');
    console.log('Error output:', error.stdout?.toString() || error.message);
    console.log('---\n');
  }
}

console.log('Validation complete!');
