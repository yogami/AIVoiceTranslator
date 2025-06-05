import { afterAll, beforeAll } from 'vitest';

// Global setup for integration tests
beforeAll(() => {
  // Set longer timeout for integration tests
  process.env.NODE_ENV = 'test';
  
  // Force memory storage for all integration tests
  process.env.STORAGE_TYPE = 'memory';
  process.env.E2E_TEST_MODE = 'true';
  
  // Clear DATABASE_URL to ensure memory storage is used
  delete process.env.DATABASE_URL;
  
  // Set test-specific OpenAI key if not already set
  if (!process.env.OPENAI_API_KEY) {
    process.env.OPENAI_API_KEY = 'test-key-for-integration-tests';
  }
  
  // Suppress console logs during tests unless debugging
  if (!process.env.DEBUG) {
    console.log = () => {};
    console.info = () => {};
    console.warn = () => {};
  }
});

afterAll(() => {
  // Clean up any remaining connections or resources
  // This helps prevent hanging tests
});

// Handle unhandled rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});
