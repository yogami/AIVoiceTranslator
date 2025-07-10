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

// Determine test mode from environment
const testMode = process.env.TEST_MODE || 'all';
console.log(`[Vitest Setup] Test mode: ${testMode}`);

// Initialize test isolation based on mode
if (testMode !== 'unit') {
  // Enable test isolation for component and integration tests
  process.env.TEST_ISOLATION_ENABLED = 'true';
  console.log('[Vitest Setup] Test isolation enabled for non-unit tests');
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

// Enhanced error handling for different test modes
process.on('uncaughtException', (error) => {
  console.error(`[Test ${testMode}] Uncaught Exception:`, error);
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
  console.error(`[Test ${testMode}] Unhandled Rejection at:`, promise, 'reason:', reason);
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

// Add test isolation markers
if (process.env.TEST_ISOLATION_ENABLED === 'true') {
  const startTime = Date.now();
  console.log(`[Vitest Setup] Test isolation active - Started at ${new Date(startTime).toISOString()}`);
  
  // Track test suite start
  process.env.TEST_SUITE_START_TIME = startTime.toString();
}

// Don't set global config in setup file, it will be handled by config files