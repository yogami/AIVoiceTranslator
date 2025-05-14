#!/usr/bin/env node

/**
 * TextToSpeechService Test Runner
 * 
 * This script runs the tests for the TextToSpeechService using Vitest.
 * 
 * It uses the same configuration as the TranslationService tests
 * to ensure consistent test behavior and coverage reporting.
 */

import { spawnSync } from 'child_process';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

// Get the current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Config and pattern
const configPath = './test-config/vitest/vitest.config.mjs';
const testPattern = './tests/unit/services/TextToSpeechService.spec.ts';

// Display info message
console.log('✨ Running TextToSpeechService tests with Vitest');
console.log(`✨ Using dedicated test configuration: ${configPath}`);
console.log(`✨ Test pattern: ${testPattern}`);
console.log('');

// Run Vitest with the configuration
const result = spawnSync('npx', [
  'vitest', 'run',
  '--config', configPath,
  testPattern
], {
  cwd: resolve(__dirname, '..'),
  stdio: 'inherit',
  shell: true
});

// Exit with the same code as the command
process.exit(result.status);