/**
 * Test Database Isolation Utility
 * 
 * Provides isolated database storage instances for integration tests to prevent
 * test interference and ensure proper isolation between test files.
 */

import { DatabaseStorage } from '../../server/database-storage';
import crypto from 'crypto';

export class TestDatabaseIsolation {
  private static testInstances = new Map<string, DatabaseStorage>();
  private static testLocks = new Map<string, Promise<void>>();
  private static globalInitLock: Promise<void> | null = null;

  /**
   * Get an isolated database storage instance for a test file
   * This ensures each test file gets its own clean database state
   */
  static async getIsolatedStorage(testFileId: string): Promise<DatabaseStorage> {
    // Create a unique test instance identifier
    const instanceId = `${testFileId}-${crypto.randomUUID()}`;
    
    // Ensure global initialization happens one at a time
    if (this.globalInitLock) {
      await this.globalInitLock;
    }

    const initPromise = this.initializeIsolatedInstance(instanceId);
    this.globalInitLock = initPromise.then(() => {});
    
    const storage = await initPromise;
    this.testInstances.set(instanceId, storage);
    
    // Clean up the global lock
    this.globalInitLock = null;
    
    return storage;
  }

  /**
   * Initialize a clean, isolated database instance
   */
  private static async initializeIsolatedInstance(instanceId: string): Promise<DatabaseStorage> {
    const storage = new DatabaseStorage();
    
    // Reset the database completely first
    await storage.reset();
    
    // Add delay to ensure reset is complete
    await new Promise(resolve => setTimeout(resolve, 200));
    
    // Initialize with default data
    await storage.initializeDefaultLanguages();
    
    // Final delay to ensure all async operations complete
    await new Promise(resolve => setTimeout(resolve, 100));
    
    return storage;
  }

  /**
   * Clean up a test instance
   */
  static async cleanupInstance(testFileId: string): Promise<void> {
    // Wait for any pending operations
    if (this.testLocks.has(testFileId)) {
      await this.testLocks.get(testFileId);
    }

    // Find and cleanup instances for this test file
    const instancesToCleanup = Array.from(this.testInstances.entries())
      .filter(([id]) => id.startsWith(testFileId));

    for (const [instanceId, storage] of instancesToCleanup) {
      try {
        await storage.reset();
        this.testInstances.delete(instanceId);
      } catch (error) {
        console.warn(`Failed to cleanup test instance ${instanceId}:`, error);
      }
    }
  }

  /**
   * Global cleanup - should be called in test teardown
   */
  static async globalCleanup(): Promise<void> {
    // Wait for all pending operations
    await Promise.all(Array.from(this.testLocks.values()));
    
    // Reset all instances
    for (const [instanceId, storage] of this.testInstances) {
      try {
        await storage.reset();
      } catch (error) {
        console.warn(`Failed to cleanup instance ${instanceId}:`, error);
      }
    }
    
    this.testInstances.clear();
    this.testLocks.clear();
  }
}

/**
 * Test setup helper for integration tests
 */
export async function setupIsolatedTest(testFileName: string): Promise<DatabaseStorage> {
  const storage = await TestDatabaseIsolation.getIsolatedStorage(testFileName);
  return storage;
}

/**
 * Test cleanup helper for integration tests
 */
export async function cleanupIsolatedTest(testFileName: string): Promise<void> {
  await TestDatabaseIsolation.cleanupInstance(testFileName);
}
