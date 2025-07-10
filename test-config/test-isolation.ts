/**
 * Comprehensive Test Isolation Utilities
 * 
 * This file provides utilities to ensure test isolation between different test suites
 * by managing database state, global variables, and other shared resources.
 * It includes both low-level isolation utilities and high-level setup functions.
 */

import { randomUUID } from 'crypto';
import { beforeAll, afterAll } from 'vitest';

// Global test context to track current test suite
export interface TestContext {
  suiteId: string;
  suiteName: string;
  suiteType: 'unit' | 'component' | 'integration';
  startTime: number;
  dbPrefix?: string;
}

// Store current test context
let currentTestContext: TestContext | null = null;

// Global cleanup registry for resources that need cleanup
const globalCleanupTasks: Array<() => Promise<void> | void> = [];

/**
 * Initialize a new test suite context
 */
export function initializeTestSuite(suiteName: string, suiteType: 'unit' | 'component' | 'integration'): TestContext {
  const suiteId = randomUUID();
  const context: TestContext = {
    suiteId,
    suiteName,
    suiteType,
    startTime: Date.now(),
    dbPrefix: `test_${suiteType}_${suiteId.replace(/-/g, '_')}`
  };
  
  currentTestContext = context;
  
  // Set environment variables for test isolation
  process.env.TEST_SUITE_ID = suiteId;
  process.env.TEST_SUITE_TYPE = suiteType;
  process.env.TEST_SUITE_NAME = suiteName;
  
  console.log(`[Test Isolation] Initialized test suite: ${suiteName} (${suiteType}) with ID: ${suiteId}`);
  
  return context;
}

/**
 * Get the current test context
 */
export function getCurrentTestContext(): TestContext | null {
  return currentTestContext;
}

/**
 * Clean up test suite context
 */
export function cleanupTestSuite(): void {
  if (currentTestContext) {
    const duration = Date.now() - currentTestContext.startTime;
    console.log(`[Test Isolation] Cleaning up test suite: ${currentTestContext.suiteName} (${duration}ms)`);
    
    // Clear environment variables
    delete process.env.TEST_SUITE_ID;
    delete process.env.TEST_SUITE_TYPE;
    delete process.env.TEST_SUITE_NAME;
    
    currentTestContext = null;
  }
}

/**
 * Create a unique table prefix for the current test suite
 */
export function getTestTablePrefix(): string {
  if (!currentTestContext?.dbPrefix) {
    throw new Error('No test context initialized. Call initializeTestSuite() first.');
  }
  return currentTestContext.dbPrefix;
}

/**
 * Reset global state between test suites
 */
export function resetGlobalState(): void {
  // Clear any global caches or state
  if (global.gc) {
    global.gc();
  }
  
  // Note: Jest is not used in this project (using Vitest), so skip jest cleanup
  
  // Clear any module cache that might interfere
  // Note: Be careful with this as it can break module loading
  const moduleCache = require.cache;
  for (const moduleId in moduleCache) {
    if (moduleId.includes('server/services') || moduleId.includes('server/storage')) {
      delete moduleCache[moduleId];
    }
  }
}

/**
 * Register a cleanup task to be run at the end of all tests
 */
export function registerGlobalCleanup(task: () => Promise<void> | void): void {
  globalCleanupTasks.push(task);
}

/**
 * Setup test isolation for a specific test suite (high-level API)
 */
export function setupTestIsolation(suiteName: string, suiteType: 'unit' | 'component' | 'integration') {
  let testContext: TestContext | null = null;
  
  beforeAll(async () => {
    // Initialize test suite with unique context
    testContext = initializeTestSuite(suiteName, suiteType);
    
    // Reset global state to ensure clean start
    resetGlobalState();
    
    // Set up suite-specific environment
    process.env.TEST_ISOLATION_ENABLED = 'true';
    
    console.log(`[Test Setup] Suite ${suiteName} (${suiteType}) initialized with isolation`);
  });
  
  afterAll(async () => {
    try {
      // Wait for any pending async operations
      await waitForAsyncOperations(1000);
      
      // Clean up test suite context
      cleanupTestSuite();
      
      // Clean up environment
      delete process.env.TEST_ISOLATION_ENABLED;
      
      console.log(`[Test Setup] Suite ${suiteName} cleanup completed`);
    } catch (error) {
      console.error(`[Test Setup] Error during suite cleanup for ${suiteName}:`, error);
    }
  });
  
  return testContext;
}

/**
 * Create isolation setup function for test files (low-level API)
 */
export function createTestSuiteSetup(suiteName: string, suiteType: 'unit' | 'component' | 'integration') {
  return {
    beforeAll: async () => {
      initializeTestSuite(suiteName, suiteType);
      resetGlobalState();
    },
    afterAll: async () => {
      cleanupTestSuite();
    }
  };
}

/**
 * Global cleanup handler for process exit
 */
async function runGlobalCleanup(): Promise<void> {
  console.log('[Test Isolation] Running global cleanup tasks...');
  
  for (const task of globalCleanupTasks) {
    try {
      await task();
    } catch (error) {
      console.error('[Test Isolation] Error in cleanup task:', error);
    }
  }
  
  globalCleanupTasks.length = 0;
  console.log('[Test Isolation] Global cleanup completed');
}

// Register global cleanup handlers
process.on('exit', () => {
  try {
    // Synchronous cleanup only
    console.log('[Test Isolation] Process exiting, running sync cleanup...');
  } catch (error) {
    console.error('[Test Isolation] Error in exit cleanup:', error);
  }
});

process.on('SIGINT', async () => {
  console.log('[Test Isolation] Received SIGINT, cleaning up...');
  await runGlobalCleanup();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('[Test Isolation] Received SIGTERM, cleaning up...');
  await runGlobalCleanup();
  process.exit(0);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('[Test Isolation] Unhandled Promise Rejection:', reason);
  console.error('[Test Isolation] Promise:', promise);
});

/**
 * Wait for all async operations to complete
 */
export function waitForAsyncOperations(timeout = 5000): Promise<void> {
  return new Promise((resolve) => {
    let timeoutId: NodeJS.Timeout;
    let intervalId: NodeJS.Timeout;
    
    const checkComplete = () => {
      // Check if all microtasks are done
      process.nextTick(() => {
        setImmediate(() => {
          clearTimeout(timeoutId);
          clearInterval(intervalId);
          resolve();
        });
      });
    };
    
    // Set a timeout to prevent infinite waiting
    timeoutId = setTimeout(() => {
      clearInterval(intervalId);
      resolve();
    }, timeout);
    
    // Check periodically
    intervalId = setInterval(checkComplete, 10);
  });
}

/**
 * Create a unique session ID for tests
 */
export function createTestSessionId(): string {
  const context = getCurrentTestContext();
  if (!context) {
    return `test-session-${Date.now()}-${Math.random().toString(36).substring(7)}`;
  }
  return `test-${context.suiteType}-${context.suiteId.substring(0, 8)}-${Date.now()}`;
}

/**
 * Create a unique teacher ID for tests
 */
export function createTestTeacherId(): string {
  const context = getCurrentTestContext();
  if (!context) {
    return `test-teacher-${Date.now()}-${Math.random().toString(36).substring(7)}`;
  }
  return `test-teacher-${context.suiteType}-${context.suiteId.substring(0, 8)}-${Date.now()}`;
}
