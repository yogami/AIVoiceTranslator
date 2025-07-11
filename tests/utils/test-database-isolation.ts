/**
 * Test Database Isolation Utility
 * 
 * Provides isolated database storage instances for integration tests to prevent
 * test interference and ensure proper isolation between test files.
 */

import { DatabaseStorage } from '../../server/database-storage';
import { TestDatabaseManager } from './TestDatabaseManager';
import { withDatabaseLock } from './database-lock';

// Force the NODE_ENV to 'test' for all tests that use this utility
// This is a safety measure to ensure database reset works properly
if (process.env.NODE_ENV !== 'test') {
  console.warn('Forcing NODE_ENV to "test" for database operations in TestDatabaseIsolation');
  process.env.NODE_ENV = 'test';
}

export class TestDatabaseIsolation {
  private static storageInstances: Map<string, TestDatabaseManager> = new Map();
  private static initPromises: Map<string, Promise<TestDatabaseManager>> = new Map();

  /**
   * Get an isolated database storage instance for a specific test
   * Each test gets its own storage instance and database state
   */
  static async getIsolatedStorage(testId: string): Promise<TestDatabaseManager> {
    // Check if we already have an initialization in progress for this test
    const existingPromise = this.initPromises.get(testId);
    if (existingPromise) {
      return existingPromise;
    }

    // Check if we already have a storage instance for this test
    const existingStorage = this.storageInstances.get(testId);
    if (existingStorage) {
      return existingStorage;
    }

    // Create new storage instance for this test
    const initPromise = this.createFreshStorage(testId);
    this.initPromises.set(testId, initPromise);
    
    try {
      const storage = await initPromise;
      this.storageInstances.set(testId, storage);
      return storage;
    } finally {
      this.initPromises.delete(testId);
    }
  }

  /**
   * Create a fresh storage instance with complete isolation
   */
  private static async createFreshStorage(testId: string): Promise<TestDatabaseManager> {
    return withDatabaseLock(async () => {
      console.log(`[TestIsolation] Creating fresh storage for ${testId} (with DB lock)`);
      
      const storage = new TestDatabaseManager();
      
      // AGGRESSIVE: Reset the database completely and wait longer for it to take effect
      console.log(`[TestIsolation] Resetting database for ${testId}`);
      await storage.resetDatabase();
      
      // Wait longer for reset to complete and all connections to stabilize
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Initialize with default data
      console.log(`[TestIsolation] Initializing default languages for ${testId}`);
      await storage.initializeDefaultLanguages();
      
      // Wait longer for initialization to complete
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // VERIFICATION: Check that database is actually clean
      try {
        const isClean = await storage.verifyDatabaseClean();
        if (!isClean) {
          console.warn(`[TestIsolation] WARNING: Database not clean for ${testId}`);
          // Try reset again
          await storage.resetDatabase();
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      } catch (error) {
        console.warn(`[TestIsolation] Could not verify database clean state for ${testId}:`, error);
      }
      
      console.log(`[TestIsolation] Database ready for ${testId}`);
      return storage;
    });
  }

  /**
   * Clean up a specific test instance
   */
  static async cleanupInstance(testId: string): Promise<void> {
    return withDatabaseLock(async () => {
      const storage = this.storageInstances.get(testId);
      if (storage) {
        try {
          console.log(`[TestIsolation] Cleaning up storage for ${testId} (with DB lock)`);
          await storage.resetDatabase();
          this.storageInstances.delete(testId);
        } catch (error) {
          console.warn(`Failed to cleanup storage for ${testId}:`, error);
        }
      }
      this.initPromises.delete(testId);
    });
  }

  /**
   * Global cleanup - should be called in test teardown
   */
  static async globalCleanup(): Promise<void> {
    // Clean up all storage instances
    for (const [testId, storage] of this.storageInstances.entries()) {
      try {
        await storage.resetDatabase();
      } catch (error) {
        console.warn(`Failed to cleanup storage for ${testId}:`, error);
      }
    }
    this.storageInstances.clear();
    this.initPromises.clear();
  }
}

/**
 * Test setup helper for integration tests
 */
export async function setupIsolatedTest(testId: string): Promise<TestDatabaseManager> {
  const storage = await TestDatabaseIsolation.getIsolatedStorage(testId);
  return storage;
}

/**
 * Test cleanup helper for integration tests
 */
export async function cleanupIsolatedTest(testId: string): Promise<void> {
  await TestDatabaseIsolation.cleanupInstance(testId);
}
