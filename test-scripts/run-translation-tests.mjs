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

// Path to the test file we want to run
const testPattern = './tests/unit/services/TranslationService.spec.ts';

// Config file path (relative to project root)
const configPath = './test-config/vitest/vitest.config.mjs';

console.log(`✨ Running TranslationService tests with Vitest`);
console.log(`✨ Using dedicated test configuration: ${configPath}`);
console.log(`✨ Test pattern: ${testPattern}`);

// Path to the Vitest binary in node_modules
const vitestBin = resolve(process.cwd(), './node_modules/.bin/vitest');

// Check if Vitest exists
if (!existsSync(vitestBin)) {
  console.error('❌ Vitest not found. Please run: npm install vitest');
  process.exit(1);
}

// Run the test with Vitest using our isolated configuration
// Add coverage flag to generate coverage report
const result = spawnSync(vitestBin, ['run', testPattern, '--config', configPath, '--coverage'], {
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