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
    case 'component':
      return ['**/tests/component/**/*.{test,spec}.{js,jsx,ts,tsx}'];
    case 'integration':
      return ['**/tests/integration/**/*.{test,spec}.{js,jsx,ts,tsx}'];
    case 'all':
    default:
      // Exclude e2e tests from default 'all' mode (they use Playwright)
      return [
        'tests/unit/**/*.{test,spec}.?(c|m)[jt]s?(x)',
        'tests/component/**/*.{test,spec}.?(c|m)[jt]s?(x)',
        'tests/integration/**/*.{test,spec}.?(c|m)[jt]s?(x)'
      ];
  }
};

// Configure test timeouts based on test mode
const getTestTimeouts = (mode) => {
  switch (mode) {
    case 'integration':
      return {
        testTimeout: 120000,         // 2 minutes per integration test
        hookTimeout: 60000,          // 1 minute for hooks 
        teardownTimeout: 30000,      // 30 seconds for teardown
      };
    case 'component':
      return {
        testTimeout: 60000,          // 1 minute per component test
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

const setupFiles = [
  './test-config/test-env.js',  // This will now handle all env var checks and loading from .env.test
  './test-config/vitest/vitest.setup.ts',
  // Add test isolation setup for component and integration tests
  ...(testMode === 'component' || testMode === 'integration' ? ['./test-config/test-isolation.ts'] : [])
];

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
      '**/tests/e2e/**',
      'server/websocket.ts',
      'server/services/managers/WebSocketClientManager.ts',
      'server/test-db.ts',
      'server/vite.ts',
      'server/services/WebSocketTypes.ts',
      'server/services/DiagnosticsService.ts',
    ],
    ...getTestTimeouts(testMode),
    // For integration tests, enforce strict sequential execution
    maxConcurrency: testMode === 'integration' ? 1 : (testMode === 'component' ? 1 : 2),
    maxThreads: testMode === 'integration' ? 1 : (testMode === 'component' ? 1 : 2),
    minThreads: testMode === 'integration' ? 1 : (testMode === 'component' ? 1 : 1),
    silent: false,
    isolate: true,
    // Use threads with single thread for integration and component tests
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: testMode === 'integration' || testMode === 'component',
        useAtomics: testMode === 'integration' || testMode === 'component', // Force atomic operations for integration/component tests
      }
    },
    // Increase worker timeouts to prevent RPC timeout errors
    workerTimeout: testMode === 'integration' ? 180000 : (testMode === 'component' ? 120000 : 60000), // 3min/2min/1min
    fileParallelism: testMode === 'integration' || testMode === 'component' ? false : true,
    setupFiles,
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
        'server/test-db.ts',
        'server/vite.ts',
        'server/services/WebSocketTypes.ts',
        'server/services/DiagnosticsService.ts',
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
      '@websocket': resolve(projectRoot, 'server/websocket'),
      '@openai': resolve(projectRoot, 'server/openai'),
      '@storage': resolve(projectRoot, 'server/storage'),
      '@helpers': resolve(projectRoot, 'server/services/helpers'),
      '@managers': resolve(projectRoot, 'server/services/managers'),
      '@handlers': resolve(projectRoot, 'server/services/handlers')
    }
  }
});