import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/baseline/**/*.test.ts'],
    exclude: [],
    reporters: 'default',
    testTimeout: 20000,
    hookTimeout: 20000,
    poolOptions: {
      threads: {
        singleThread: true,
      },
    },
  },
});


