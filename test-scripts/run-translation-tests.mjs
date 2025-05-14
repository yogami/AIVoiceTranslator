#!/usr/bin/env node

/**
 * This script runs Vitest tests for the TranslationService module
 * It uses a dedicated configuration file that is completely isolated from the application
 * 
 * Following testing principles:
 * - Do NOT modify source code
 * - Do NOT mock the System Under Test (SUT)
 * - Only mock external dependencies
 */

import { spawnSync } from 'child_process';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';

// Get the directory of the current module
const __dirname = dirname(fileURLToPath(import.meta.url));

// Path to the test files we want to run
const testPatterns = [
  './tests/unit/services/TranslationService.spec.ts',
  './tests/unit/services/TranslationServiceErrorHandling.spec.ts',
  './tests/unit/services/TranslationServiceEmptyResponse.spec.ts'
];

// Config file path (relative to project root)
const configPath = './test-config/vitest/vitest.config.mjs';

console.log(`✨ Running TranslationService tests with Vitest`);
console.log(`✨ Using dedicated test configuration: ${configPath}`);
console.log(`✨ Test patterns: ${testPatterns.join(', ')}`);

// Path to the Vitest binary in node_modules
const vitestBin = resolve(process.cwd(), './node_modules/.bin/vitest');

// Check if Vitest exists
if (!existsSync(vitestBin)) {
  console.error('❌ Vitest not found. Please run: npm install vitest');
  process.exit(1);
}

// Run the tests with Vitest using our isolated configuration and coverage
// Add --silent flag for cleaner output and use a large testTimeout
const args = [
  'run',
  ...testPatterns, // Include all test patterns 
  '--config', configPath,
  '--coverage',
  '--test-timeout=60000', // 60 seconds timeout for tests with retry logic
  '--pool=forks' // Run tests in isolated processes
];

console.log(`Running command: ${vitestBin} ${args.join(' ')}`);

const result = spawnSync(vitestBin, args, {
  stdio: 'inherit',
  shell: true,
  env: {
    ...process.env,
    NODE_ENV: 'test',
    NODE_OPTIONS: '--experimental-vm-modules'
  }
});

// Exit with the same code as the test process
process.exit(result.status);