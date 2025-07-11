/**
 * Test Database Manager
 * 
 * Provides database management utilities for tests without contaminating production code.
 * This class extends the production DatabaseStorage with test-specific functionality.
 */

import { DatabaseStorage } from '../../server/database-storage';
import { db } from '../../server/db';
import { translations, sessions, users, languages } from '../../shared/schema';
import { transcripts as transcriptsTable } from '../../shared/schema';
import logger from '../../server/logger';

export class TestDatabaseManager extends DatabaseStorage {
  
  /**
   * Reset the database to a clean state - TEST ONLY
   * This method should NEVER exist in production code
   */
  async resetDatabase(): Promise<void> {
    if (process.env.NODE_ENV !== 'test') {
      throw new Error('Database reset is only allowed in test environments.');
    }
    
    if (!db) {
      throw new Error('Database not initialized');
    }
    
    try {
      // Add a small delay to avoid race conditions
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Clear tables in dependency order and handle potential foreign key constraints
      await db.delete(translations).execute();
      await db.delete(transcriptsTable).execute();
      await db.delete(sessions).execute();
      await db.delete(users).execute();
      await db.delete(languages).execute();
      
      // Add another delay to ensure all deletions are committed
      await new Promise(resolve => setTimeout(resolve, 100));
      
      logger.info('Test database reset complete.');
    } catch (error) {
      logger.error('Error during test database reset:', error);
      throw error;
    }
  }
  
  /**
   * Initialize test database with default data
   */
  async initializeTestDatabase(): Promise<void> {
    await this.resetDatabase();
    await this.initializeDefaultLanguages();
  }
  
  /**
   * Verify database is clean (for test verification)
   */
  async verifyDatabaseClean(): Promise<boolean> {
    if (!db) {
      return false;
    }
    
    try {
      const translationCount = await db.select().from(translations).execute();
      const sessionCount = await db.select().from(sessions).execute();
      const userCount = await db.select().from(users).execute();
      
      return translationCount.length === 0 && sessionCount.length === 0 && userCount.length === 0;
    } catch (error) {
      logger.error('Error verifying database clean state:', error);
      return false;
    }
  }
  
  /**
   * Get database statistics for debugging
   */
  async getDatabaseStats(): Promise<{
    translations: number;
    sessions: number;
    users: number;
    languages: number;
  }> {
    if (!db) {
      return { translations: 0, sessions: 0, users: 0, languages: 0 };
    }
    
    try {
      const [translationCount, sessionCount, userCount, languageCount] = await Promise.all([
        db.select().from(translations).execute(),
        db.select().from(sessions).execute(),
        db.select().from(users).execute(),
        db.select().from(languages).execute()
      ]);
      
      return {
        translations: translationCount.length,
        sessions: sessionCount.length,
        users: userCount.length,
        languages: languageCount.length
      };
    } catch (error) {
      logger.error('Error getting database stats:', error);
      return { translations: 0, sessions: 0, users: 0, languages: 0 };
    }
  }
}

/**
 * Factory function to create a test database manager
 */
export function createTestDatabaseManager(): TestDatabaseManager {
  return new TestDatabaseManager();
}
