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
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      reportsDirectory: './coverage',
      exclude: ['**/node_modules/**', '**/tests/**'],
      include: ['server/websocket.ts', 'server/services/TextToSpeechService.ts'],
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
      '@server': resolve(process.cwd(), './server'),
      '@shared': resolve(process.cwd(), './shared'),
      '@client': resolve(process.cwd(), './client'),
      '@tests': resolve(process.cwd(), './tests')
    }
  }
});