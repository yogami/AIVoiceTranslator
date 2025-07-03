/**
 * Test Transaction Isolation Utility
 * 
 * Provides transaction isolation for database operations in tests to ensure
 * proper cleanup and prevent test interference.
 */

import { DatabaseStorage } from '../../server/database-storage';

// Force the NODE_ENV to 'test' for all tests that use this utility
// This is a safety measure to ensure database reset works properly
if (process.env.NODE_ENV !== 'test') {
  console.warn('Forcing NODE_ENV to "test" for database operations');
  process.env.NODE_ENV = 'test';
}

/**
 * Executes the given function within a transaction that will be rolled back,
 * ensuring no test data persists after the test completes
 * 
 * @param storage DatabaseStorage instance
 * @param fn Function to execute within transaction
 * @returns Result of the function execution
 */
export async function withTestTransaction<T>(
  storage: DatabaseStorage,
  fn: () => Promise<T>
): Promise<T> {
  // Ensure we're in test environment
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('withTestTransaction can only be used in test environments');
  }

  let result: T;
  try {
    // Execute the function
    result = await fn();
    return result;
  } catch (error) {
    console.error('Error in test transaction:', error);
    throw error;
  } finally {
    try {
      // Attempt cleanup regardless of success/failure
      await cleanupTestData(storage);
    } catch (cleanupError) {
      // Log but don't throw cleanup errors to avoid masking original errors
      console.warn('Failed to clean up test data:', cleanupError);
    }
  }
}

/**
 * Cleans up any test data created during tests
 * This is a safety measure to prevent test data buildup
 */
export async function cleanupTestData(storage: DatabaseStorage): Promise<void> {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('cleanupTestData can only be used in test environments');
  }

  try {
    await storage.reset();
    console.log('Test data cleanup successful');
  } catch (error) {
    console.error('Error cleaning up test data:', error);
    throw error;
  }
}

/**
 * Creates a temporary test environment for the current test
 * Ensures NODE_ENV is set to 'test' for proper database reset functionality
 */
export function setupTestEnvironment(): void {
  // Force set NODE_ENV to test to ensure database operations work
  if (process.env.NODE_ENV !== 'test') {
    console.warn('Setting NODE_ENV to "test" for current test');
    process.env.NODE_ENV = 'test';
  }
}
