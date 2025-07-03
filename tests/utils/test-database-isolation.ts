/**
 * Test Database Isolation Utility
 * 
 * Provides isolated database storage instances for integration tests to prevent
 * test interference and ensure proper isolation between test files.
 */

import { DatabaseStorage } from '../../server/database-storage';

// Force the NODE_ENV to 'test' for all tests that use this utility
// This is a safety measure to ensure database reset works properly
if (process.env.NODE_ENV !== 'test') {
  console.warn('Forcing NODE_ENV to "test" for database operations in TestDatabaseIsolation');
  process.env.NODE_ENV = 'test';
}

export class TestDatabaseIsolation {
  private static currentStorage: DatabaseStorage | null = null;
  private static initPromise: Promise<DatabaseStorage> | null = null;

  /**
   * Get an isolated database storage instance for a test file
   * This ensures proper sequential access to the database
   */
  static async getIsolatedStorage(testFileId: string): Promise<DatabaseStorage> {
    // If there's already an initialization in progress, wait for it
    if (this.initPromise) {
      return this.initPromise;
    }

    // Start new initialization
    this.initPromise = this.createFreshStorage(testFileId);
    
    try {
      this.currentStorage = await this.initPromise;
      return this.currentStorage;
    } finally {
      this.initPromise = null;
    }
  }

  /**
   * Create a fresh storage instance
   */
  private static async createFreshStorage(testFileId: string): Promise<DatabaseStorage> {
    console.log(`[TestIsolation] Creating fresh storage for ${testFileId}`);
    
    const storage = new DatabaseStorage();
    
    // Reset the database completely
    console.log(`[TestIsolation] Resetting database for ${testFileId}`);
    await storage.reset();
    
    // Wait for reset to complete
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // Initialize with default data
    console.log(`[TestIsolation] Initializing default languages for ${testFileId}`);
    await storage.initializeDefaultLanguages();
    
    // Wait for initialization to complete
    await new Promise(resolve => setTimeout(resolve, 200));
    
    console.log(`[TestIsolation] Database ready for ${testFileId}`);
    return storage;
  }

  /**
   * Clean up a test instance
   */
  static async cleanupInstance(testFileId: string): Promise<void> {
    if (this.currentStorage) {
      try {
        console.log(`[TestIsolation] Cleaning up storage for ${testFileId}`);
        await this.currentStorage.reset();
      } catch (error) {
        console.warn(`Failed to cleanup storage for ${testFileId}:`, error);
      }
    }
    this.currentStorage = null;
  }

  /**
   * Global cleanup - should be called in test teardown
   */
  static async globalCleanup(): Promise<void> {
    if (this.currentStorage) {
      try {
        await this.currentStorage.reset();
      } catch (error) {
        console.warn('Failed to perform global cleanup:', error);
      }
    }
    this.currentStorage = null;
    this.initPromise = null;
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
