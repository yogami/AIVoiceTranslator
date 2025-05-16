import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

/**
 * Unified Vitest configuration.
 * This single configuration handles all test scenarios with options for customization.
 * 
 * Usage examples:
 * - Run all tests: npx vitest --config test-config/vitest/vitest.unified.config.mjs
 * - Run unit tests only: npx vitest --config test-config/vitest/vitest.unified.config.mjs --test-mode=unit
 * - Run integration tests: npx vitest --config test-config/vitest/vitest.unified.config.mjs --test-mode=integration
 * - Run with coverage: npx vitest --config test-config/vitest/vitest.unified.config.mjs --coverage
 */

// Access test mode from environment or default to 'all'
const testMode = process.env.TEST_MODE || 'all';

// Configure test patterns based on test mode
const getTestPattern = (mode) => {
  switch (mode) {
    case 'unit':
      return ['**/tests/unit/**/*.{test,spec}.{js,jsx,ts,tsx}'];
    case 'integration':
      return ['**/tests/integration/**/*.{test,spec}.{js,jsx,ts,tsx}'];
    case 'e2e':
      return ['**/tests/e2e/**/*.{test,spec}.{js,jsx,ts,tsx}'];
    case 'all':
    default:
      return ['tests/**/*.{test,spec}.?(c|m)[jt]s?(x)'];
  }
};

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    testMatch: getTestPattern(testMode),
    exclude: ['**/node_modules/**', '**/dist/**', '**/build/**'],
    testTimeout: 30000,          // 30 seconds per test
    hookTimeout: 15000,          // 15 seconds for hooks 
    teardownTimeout: 10000,      // 10 seconds for teardown
    maxConcurrency: 1,           // Run tests sequentially
    maxThreads: 1,               // Use only one thread
    minThreads: 1,               // Use at least one thread
    silent: false,               // Show full output
    setupFiles: ['./test-config/vitest/vitest.setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      reportsDirectory: './coverage',
      exclude: ['**/node_modules/**', '**/tests/**'],
      include: [
        'server/websocket.ts', 
        'server/services/TextToSpeechService.ts',
        'server/services/TranslationService.ts',
        'server/openai.ts',
        'server/openai-streaming.ts',
        'server/storage.ts',
        'server/routes.ts',
        'server/config.ts',
        'server/index.ts',
        'server/vite.ts'
      ],
      all: true,
      thresholds: {
        lines: 90,
        functions: 90,
        branches: 85,
        statements: 90
      }
    }
  },
  resolve: {
    alias: {
      '@': resolve(process.cwd(), './server'),
      '@server': resolve(process.cwd(), './server'),
      '@shared': resolve(process.cwd(), './shared'),
      '@client': resolve(process.cwd(), './client'),
      '@tests': resolve(process.cwd(), './tests')
    }
  }
});