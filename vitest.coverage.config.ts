import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: [
        'server/services/**/*.ts',    // Include core service logic
        'server/routes.ts',           // Include API routes
        'server/openai-streaming.ts', // Include streaming functionality
        'server/openai.ts',           // Include OpenAI integration
      ],
      exclude: [
        'server/vite.ts',             // Exclude infrastructure code
        'server/config.ts',
        'server/server.ts',
        'server/db.ts',
        'server/index.ts',
        'server/test-db.ts',
        'config/**',                  // Exclude all config files
        'test-config/**',             // Exclude test configuration
        'test-scripts/**',            // Exclude test scripts
        'client/**',                  // Exclude client-side code from server tests
        '**/*.d.ts',                  // Exclude type definitions
        '**/*.config.{js,ts}',        // Exclude config files
        '**/node_modules/**',         // Exclude node modules
      ],
      // Set thresholds for business logic
      thresholds: {
        lines: 85,
        functions: 85,
        branches: 80,
        statements: 85
      }
    }
  }
});