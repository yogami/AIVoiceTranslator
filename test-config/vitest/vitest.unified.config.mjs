import { defineConfig } from 'vitest/config';
import { resolve } from 'path';
import tsconfigPaths from 'vite-tsconfig-paths';

/**
 * Unified Vitest configuration.
 * This single configuration handles all test scenarios with options for customization.
 * 
 * Usage examples:
 * - Run all tests: npx vitest --config test-config/vitest/vitest.unified.config.mjs
 * - Run unit tests only: npx vitest --config test-config/vitest/vitest.unified.config.mjs --test-mode=unit
 * - Run integration tests: npx vitest --config test-config/vitest/vitest.unified.config.mjs --test-mode=integration
 * - Run with coverage: npx vitest --config test-config/vitest/vitest.unified.config.mjs --coverage
 * 
 * Note: E2E tests should be run with Playwright using: npx playwright test --config test-config/playwright.config.ts
 */

// Access test mode from environment or default to 'all'
const testMode = process.env.TEST_MODE || 'all';

// Define the project root path
const projectRoot = resolve(__dirname, '../../');

// Configure test patterns based on test mode
const getTestPattern = (mode) => {
  switch (mode) {
    case 'unit':
      return ['**/tests/unit/**/*.{test,spec}.{js,jsx,ts,tsx}'];
    case 'integration':
      return ['**/tests/integration/**/*.{test,spec}.{js,jsx,ts,tsx}'];
    case 'all':
    default:
      // Exclude e2e tests from default 'all' mode (they use Playwright)
      return [
        'tests/unit/**/*.{test,spec}.?(c|m)[jt]s?(x)',
        'tests/integration/**/*.{test,spec}.?(c|m)[jt]s?(x)'
      ];
  }
};

// Configure test timeouts based on test mode
const getTestTimeouts = (mode) => {
  switch (mode) {
    case 'integration':
      return {
        testTimeout: 60000,          // 60 seconds per integration test
        hookTimeout: 30000,          // 30 seconds for hooks 
        teardownTimeout: 15000,      // 15 seconds for teardown
      };
    case 'unit':
    default:
      return {
        testTimeout: 30000,          // 30 seconds per test
        hookTimeout: 15000,          // 15 seconds for hooks 
        teardownTimeout: 10000,      // 10 seconds for teardown
      };
  }
};

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    environment: 'node',
    testMatch: getTestPattern(testMode),
    exclude: [
      '**/node_modules/**', 
      '**/dist/**', 
      '**/build/**',
      '**/tests/e2e/**',  // Explicitly exclude E2E tests
      'server/websocket.ts', // Added deprecated websocket.ts
      'server/services/managers/WebSocketClientManager.ts', // Added empty manager
      'server/test-db.ts', // Exclude test database setup
      'server/vite.ts', // Exclude vite specific config
      'server/services/WebSocketTypes.ts', // Exclude type definitions
      'server/services/DiagnosticsService.ts', // Exclude unimplemented feature
    ],
    ...getTestTimeouts(testMode),
    maxConcurrency: testMode === 'integration' ? 1 : 2,  // Sequential for integration tests
    maxThreads: testMode === 'integration' ? 1 : 2,      // Single thread for integration tests
    minThreads: 1,               // Use at least one thread
    silent: false,               // Show full output
    isolate: true,               // Isolate test environments
    pool: 'threads',             // Use thread pool for better isolation
    poolOptions: {
      threads: {
        singleThread: testMode === 'integration', // Force single thread for integration tests
      }
    },
    setupFiles: ['./test-config/vitest/vitest.setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      reportsDirectory: './coverage',
      include: [
        'server/**/*.ts'
      ],
      exclude: [
        'config/**',
        'test-config/**',
        'test-scripts/**',
        'client/**',
        '**/*.d.ts',
        '**/*.config.{js,ts}',
        '**/node_modules/**',
        'server/websocket.ts',
        'server/services/managers/WebSocketClientManager.ts',
        'server/test-db.ts', // Exclude test database setup
        'server/vite.ts', // Exclude vite specific config
        'server/services/WebSocketTypes.ts', // Exclude type definitions
        'server/services/DiagnosticsService.ts', // Exclude unimplemented feature
      ],
      all: true,
      thresholds: {
        lines: 85,
        functions: 85,
        branches: 80,
        statements: 85
      }
    }
  },
  resolve: {
    alias: {
      '@config': resolve(projectRoot, 'config'),
      '@services': resolve(projectRoot, 'server/services'),
      '@db': resolve(projectRoot, 'server/db'),
      '@routes': resolve(projectRoot, 'server/routes'),
      '@websocket': resolve(projectRoot, 'server/websocket'), // The critical one
      '@openai': resolve(projectRoot, 'server/openai'),
      '@storage': resolve(projectRoot, 'server/storage'),
      '@helpers': resolve(projectRoot, 'server/services/helpers'),
      '@managers': resolve(projectRoot, 'server/services/managers'),
      '@handlers': resolve(projectRoot, 'server/services/handlers')
    }
  }
});