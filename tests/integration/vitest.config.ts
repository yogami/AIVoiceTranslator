import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    testTimeout: 30000, // 30 seconds default timeout
    hookTimeout: 15000, // 15 seconds for hooks
    pool: 'forks', // Use forks to isolate tests
    poolOptions: {
      forks: {
        singleFork: true, // Run tests sequentially to avoid port conflicts
      },
    },
    setupFiles: ['./tests/integration/setup.ts'],
  },
});
