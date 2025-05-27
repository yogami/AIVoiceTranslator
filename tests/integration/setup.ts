import { afterAll, beforeAll } from 'vitest';

// Global setup for integration tests
beforeAll(() => {
  // Set longer timeout for integration tests
  process.env.NODE_ENV = 'test';
  
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
