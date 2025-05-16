import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    // Define root directory for tests as project root
    root: '..',
    include: ['tests/**/*.{test,spec}.ts'],
    environment: 'node',
    globals: true,
    setupFiles: ['test-config/vitest.setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'lcov', 'clover'],
      reportsDirectory: '../coverage'
    },
    clearMocks: true,
    mockReset: true,
    restoreMocks: true,
    // Adjust to match Jest's timeouts (in milliseconds)
    testTimeout: 10000
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, '../server'),
    }
  }
});