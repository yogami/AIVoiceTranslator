// This file will be referenced in Vitest config to set up global mocks
import { config } from 'dotenv';

// Load test environment variables
config({ path: '.env.test' });

// Set test environment
process.env.NODE_ENV = 'test';

// Set test-specific OpenAI key if not already set
if (!process.env.OPENAI_API_KEY) {
  process.env.OPENAI_API_KEY = 'test-key-for-unit-tests';
}

// Global cleanup handler to ensure all WebSocketServer instances are properly shut down
// This prevents background intervals from causing "Cannot use a pool after calling end on the pool" errors
process.on('exit', () => {
  try {
    // Import WebSocketServer dynamically to avoid circular dependencies
    const { WebSocketServer } = require('../../server/services/WebSocketServer');
    if (WebSocketServer && typeof WebSocketServer.shutdownAll === 'function') {
      WebSocketServer.shutdownAll();
    }
  } catch (error) {
    // Ignore errors during cleanup - this is best effort
    console.warn('[Test Cleanup] Error during WebSocketServer cleanup:', error.message);
  }
});

// Handle uncaught exceptions and unhandled rejections during tests
process.on('uncaughtException', (error) => {
  console.error('[Test] Uncaught Exception:', error);
  // Try to cleanup before exiting
  try {
    const { WebSocketServer } = require('../../server/services/WebSocketServer');
    if (WebSocketServer && typeof WebSocketServer.shutdownAll === 'function') {
      WebSocketServer.shutdownAll();
    }
  } catch (cleanupError) {
    // Ignore cleanup errors
  }
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[Test] Unhandled Rejection at:', promise, 'reason:', reason);
  // Try to cleanup
  try {
    const { WebSocketServer } = require('../../server/services/WebSocketServer');
    if (WebSocketServer && typeof WebSocketServer.shutdownAll === 'function') {
      WebSocketServer.shutdownAll();
    }
  } catch (cleanupError) {
    // Ignore cleanup errors
  }
});

// Don't set global config in setup file, it will be handled by config files