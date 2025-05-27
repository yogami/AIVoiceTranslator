import { defineConfig } from 'vitest/config';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    testTimeout: 30000, // 30 seconds for integration tests
    hookTimeout: 30000,
    include: ['tests/integration/**/*.test.ts'],
    exclude: ['tests/unit/**', 'node_modules/**'],
    setupFiles: ['./test-config/vitest/vitest.setup.ts'],
    reporters: ['default'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/**',
        'test-config/**',
        'tests/**',
        '**/*.d.ts',
        '**/*.config.*',
        '**/mockData.ts',
        'dist/**',
        'backups/**',
        'config/**'
      ]
    },
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true
      }
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '../../'),
      '@server': path.resolve(__dirname, '../../server'),
      '@client': path.resolve(__dirname, '../../client'),
      '@shared': path.resolve(__dirname, '../../shared')
    }
  }
});
