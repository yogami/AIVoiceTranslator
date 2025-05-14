#!/usr/bin/env node

/**
 * This script runs all Vitest tests for the AI Voice Translator project
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

// Config file path (relative to project root)
const configPath = './test-config/vitest/vitest.config.mjs';

console.log(`✨ Running all tests with Vitest`);
console.log(`✨ Using dedicated test configuration: ${configPath}`);

// Path to the Vitest binary in node_modules
const vitestBin = resolve(process.cwd(), './node_modules/.bin/vitest');

// Check if Vitest exists
if (!existsSync(vitestBin)) {
  console.error('❌ Vitest not found. Please run: npm install vitest');
  process.exit(1);
}

// Run the tests with Vitest using our isolated configuration
const result = spawnSync(vitestBin, ['run', '--config', configPath], {
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