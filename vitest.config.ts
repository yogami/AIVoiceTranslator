import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    testTimeout: 60000 // 60 seconds for all tests
  }
});