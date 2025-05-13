import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

/**
 * This is a dedicated Vitest configuration solely for tests.
 * It has no impact on the application code or configuration.
 */
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['**/*.spec.ts'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/build/**'],
    // Setup module mocking to avoid fs and other Node.js module issues
    setupFiles: [resolve(__dirname, './setup.ts')]
  },
  resolve: {
    alias: {
      '@server': resolve(process.cwd(), './server'),
      '@shared': resolve(process.cwd(), './shared'),
      '@client': resolve(process.cwd(), './client'),
      '@tests': resolve(process.cwd(), './tests')
    }
  }
});