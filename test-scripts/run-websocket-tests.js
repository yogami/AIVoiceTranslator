#!/usr/bin/env node

// This script runs Jest tests specifically for WebSocketService
// as part of our hybrid testing strategy

const { spawn } = require('child_process');
const path = require('path');

// Define paths
const jestConfigPath = path.resolve(__dirname, '../test-config/jest.config.js');
const testPath = path.resolve(__dirname, '../tests/unit/services/websocket.spec.ts');

// Configure Jest command
const jestCommand = 'jest';
const jestArgs = [
  '--config', jestConfigPath,
  '--verbose',
  testPath
];

// Execute Jest
console.log(`Running WebSocketService tests with Jest...`);
console.log(`Command: ${jestCommand} ${jestArgs.join(' ')}`);

const jestProcess = spawn(jestCommand, jestArgs, {
  stdio: 'inherit',
  shell: true
});

// Handle process events
jestProcess.on('error', (error) => {
  console.error(`Failed to start Jest: ${error.message}`);
  process.exit(1);
});

jestProcess.on('close', (code) => {
  if (code !== 0) {
    console.error(`Jest process exited with code ${code}`);
    process.exit(code);
  }
  console.log('WebSocketService tests completed successfully!');
});