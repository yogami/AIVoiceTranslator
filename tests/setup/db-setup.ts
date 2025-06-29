/**
 * Database Setup for Integration Tests
 * 
 * This file contains utility functions to set up and tear down test databases
 * for integration tests with PostgreSQL.
 */

import { db, pool } from '../../server/db';
import { users, languages, translations, transcripts } from '../../shared/schema';
import { drizzle } from 'drizzle-orm/neon-serverless';
import { eq } from 'drizzle-orm';

/**
 * Initialize test database by clearing existing tables and adding test data
 * Call this before running integration tests that need a clean database
 */
export async function initTestDatabase() {
  try {
    console.log('Initializing test database...');
    
    // Clear all existing data
    await clearAllTables();
    
    // Add default test data
    await addDefaultTestData();
    
    console.log('Test database initialized successfully.');
  } catch (error) {
    console.error('Failed to initialize test database:', error);
    throw error;
  }
}

/**
 * Clear all tables in the test database
 */
async function clearAllTables() {
  try {
    // Delete data from all tables in the reverse order of dependencies
    await db.delete(transcripts);
    await db.delete(translations);
    await db.delete(languages);
    await db.delete(users);
    
    console.log('All tables cleared.');
  } catch (error) {
    console.error('Error clearing tables:', error);
    throw error;
  }
}

/**
 * Add default test data to the database
 */
async function addDefaultTestData() {
  try {
    // Add default languages
    const defaultLanguages = [
      { code: 'en-US', name: 'English (United States)', isActive: true },
      { code: 'es', name: 'Spanish', isActive: true },
      { code: 'fr', name: 'French', isActive: true },
      { code: 'de', name: 'German', isActive: true },
      { code: 'ja', name: 'Japanese', isActive: false }
    ];
    
    // Insert languages one by one to handle duplicates gracefully
    for (const language of defaultLanguages) {
      try {
        await db.insert(languages).values(language);
      } catch (error: any) {
        // Ignore duplicate key errors
        if (error?.code !== '23505') {
          throw error;
        }
      }
    }
    
    // Add test user
    const testUser = {
      username: 'testuser',
      password: 'hashedpassword123'  // In a real app, this would be properly hashed
    };
    
    try {
      await db.insert(users).values(testUser);
    } catch (error: any) {
      // Ignore duplicate key errors for user
      if (error?.code !== '23505') {
        throw error;
      }
    }
    
    console.log('Default test data added.');
  } catch (error) {
    console.error('Error adding default test data:', error);
    throw error;
  }
}

/**
 * Close database connection after tests
 */
export async function closeDatabaseConnection() {
  try {
    console.log('Closing database connection...');
    await pool.end();
    console.log('Database connection closed.');
  } catch (error) {
    console.error('Error closing database connection:', error);
  }
}

/**
 * Create a test database storage instance that operates on a test database
 * Useful for integration tests that need isolation
 */
export function createTestDatabase() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL must be set for test database');
  }
  
  // Create a connection to the test database
  const testPool = pool;  // We're using the same pool as defined in server/db
  const testDb = db;      // We're using the same db instance as defined in server/db
  
  return {
    pool: testPool,
    db: testDb
  };
}

/**
 * Add a test translation to the database
 */
export async function addTestTranslation(sourceLanguage = 'en-US', targetLanguage = 'es') {
  return db.insert(translations)
    .values({
      sourceLanguage,
      targetLanguage,
      originalText: 'Hello, this is a test',
      translatedText: 'Hola, esto es una prueba',
      latency: 250
    })
    .returning();
}

/**
 * Add a test transcript to the database
 */
export async function addTestTranscript(sessionId = 'test-session-123', language = 'en-US') {
  return db.insert(transcripts)
    .values({
      sessionId,
      language,
      text: 'This is a test transcript for integration testing'
    })
    .returning();
}