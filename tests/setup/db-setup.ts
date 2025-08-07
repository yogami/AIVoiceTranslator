/**
 * Database Setup for Integration Tests
 * 
 * This file contains utility functions to set up and tear down test databases
 * for integration tests with PostgreSQL.
 */

import { db, pool } from '../../server/db';
import { users, languages, translations, transcripts, sessions } from '../../shared/schema';
import { drizzle } from 'drizzle-orm/neon-serverless';
import { eq } from 'drizzle-orm';
import { getCurrentTestContext, waitForAsyncOperations } from '../../test-config/test-isolation';
import { INTEGRATION_TEST_CONFIG } from '../helpers/test-timing';

// Track database state per test suite
const testDatabaseState = new Map<string, { initialized: boolean; cleanupPromise?: Promise<void>; available?: boolean }>();

/**
 * Test if database is available and responsive
 */
async function isDatabaseAvailable(): Promise<boolean> {
  try {
    const timeoutMs = 5000; // Fixed 5-second timeout for availability check
    console.log(`[DB Setup] Checking database availability (timeout: ${timeoutMs}ms)...`);
    
    const timeout = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Database availability check timeout')), timeoutMs)
    );
    
    const checkQuery = pool`SELECT 1`;
    await Promise.race([checkQuery, timeout]);
    
    console.log(`[DB Setup] Database is available and responsive`);
    return true;
  } catch (error) {
    console.warn(`[DB Setup] Database availability check failed:`, error instanceof Error ? error.message : String(error));
    return false;
  }
}

/**
 * Get test-specific database state key
 */
function getTestStateKey(): string {
  const context = getCurrentTestContext();
  return context ? `${context.suiteType}-${context.suiteId}` : 'default';
}

/**
 * Initialize test database by clearing existing tables and adding test data
 * Call this before running integration tests that need a clean database
 */
export async function initTestDatabase() {
  const stateKey = getTestStateKey();
  
  try {
    console.log(`[DB Setup] Initializing test database for suite: ${stateKey}`);
    
    // Check if database is available first
    const dbAvailable = await isDatabaseAvailable();
    if (!dbAvailable) {
      console.warn(`[DB Setup] Database is not available, marking as unavailable for suite: ${stateKey}`);
      testDatabaseState.set(stateKey, { initialized: false, available: false });
      
      // For now, skip database operations rather than failing
      // In the future, this could use a mock database or in-memory storage
      console.log(`[DB Setup] Skipping database initialization due to unavailability`);
      return null;
    }
    
    // Wait for any previous cleanup to complete
    const existingState = testDatabaseState.get(stateKey);
    if (existingState?.cleanupPromise) {
      console.log('[DB Setup] Waiting for previous cleanup to complete...');
      await existingState.cleanupPromise;
    }
    
    // Ensure schema is up to date first
    await ensureSchemaUpToDate();
    
    // Clear all existing data with retry logic
    await clearAllTablesWithRetry();
    
    // Add default test data
    await addDefaultTestData();
    
    // Mark as initialized and available
    testDatabaseState.set(stateKey, { initialized: true, available: true });
    
    console.log(`[DB Setup] Test database initialized successfully for suite: ${stateKey}`);
    return db; // Return the database connection for further use
  } catch (error) {
    console.error(`[DB Setup] Failed to initialize test database for suite ${stateKey}:`, error);
    // Mark as unavailable on error
    testDatabaseState.set(stateKey, { initialized: false, available: false });
    throw error;
  }
}

/**
 * Ensure the database schema has all required columns
 */
async function ensureSchemaUpToDate() {
  try {
    // Use scaled timeout instead of hardcoded value
    const timeoutMs = INTEGRATION_TEST_CONFIG.STORAGE_OPERATION_TIMEOUT;
    console.log(`[DB Setup] Using schema check timeout: ${timeoutMs}ms`);
    
    const timeout = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Schema check timeout')), timeoutMs)
    );
    
    const schemaCheck = (async () => {
      console.log(`[DB Setup] Starting schema check...`);
      // Check if teacher_id column exists in sessions table
      // Use the pool directly with SQL template literal syntax
      const result = await pool`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'sessions' AND column_name = 'teacher_id'
      `;
      
      if (result.length === 0) {
        console.log('Adding missing teacher_id column to sessions table...');
        await pool`ALTER TABLE sessions ADD COLUMN teacher_id TEXT`;
        console.log('teacher_id column added successfully.');
      } else {
        console.log('teacher_id column already exists.');
      }
    })();
    
    await Promise.race([schemaCheck, timeout]);
  } catch (error) {
    console.error('Error ensuring schema is up to date:', error);
    throw error;
  }
}

/**
 * Clear all tables in the test database with retry logic
 */
async function clearAllTablesWithRetry(maxRetries = 3) {
  const stateKey = getTestStateKey();
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[DB Setup] Clearing tables for suite ${stateKey} (attempt ${attempt}/${maxRetries})`);
      
      // Wait for any pending operations to complete (scaled timeout)
      await waitForAsyncOperations(INTEGRATION_TEST_CONFIG.DATABASE_SYNC_WAIT);
      
      // Use scaled timeout instead of hardcoded value
      const timeoutMs = INTEGRATION_TEST_CONFIG.STORAGE_OPERATION_TIMEOUT;
      console.log(`[DB Setup] Using clear tables timeout: ${timeoutMs}ms`);
      
      const clearTimeout = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Clear tables timeout')), timeoutMs)
      );
      
      const clearOperation = (async () => {
        console.log(`[DB Setup] Starting table clearing operations...`);
        // Delete data from all tables in the reverse order of dependencies
        await db.delete(transcripts);
        await db.delete(translations);
        await db.delete(sessions);
        await db.delete(languages);
        await db.delete(users);
        
        console.log(`[DB Setup] All tables cleared successfully for suite: ${stateKey}`);
      })();
      
      // Use race to enforce timeout
      await Promise.race([clearOperation, clearTimeout]);
      return;
    } catch (error) {
      lastError = error as Error;
      console.warn(`[DB Setup] Error clearing tables (attempt ${attempt}/${maxRetries}):`, error);
      
      if (attempt < maxRetries) {
        // Use scaled retry delay
        await new Promise(resolve => setTimeout(resolve, INTEGRATION_TEST_CONFIG.RETRY_DELAY * attempt));
      }
    }
  }
  
  throw new Error(`Failed to clear tables after ${maxRetries} attempts. Last error: ${lastError?.message}`);
}

/**
 * Clear all tables in the test database (legacy function for compatibility)
 */
async function clearAllTables() {
  return clearAllTablesWithRetry();
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
 * Check if database is available for testing
 */
export function isDatabaseAvailableForTesting(): boolean {
  const stateKey = getTestStateKey();
  const state = testDatabaseState.get(stateKey);
  return state?.available === true;
}

/**
 * Close database connection after tests
 */
export async function closeDatabaseConnection() {
  const stateKey = getTestStateKey();
  
  try {
    console.log(`[DB Setup] Closing database connection for suite: ${stateKey}`);
    
    // Create cleanup promise with scaled timeout
    const cleanupTimeout = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Database cleanup timeout')), INTEGRATION_TEST_CONFIG.STORAGE_OPERATION_TIMEOUT * 3)
    );
    
    const cleanupPromise = (async () => {
      // Wait for any pending operations (scaled timeout)
      await waitForAsyncOperations(INTEGRATION_TEST_CONFIG.DATABASE_SYNC_WAIT * 5);
      
      // Clear tables with fewer retries for faster cleanup
      try {
        await clearAllTablesWithRetry(1);
      } catch (error) {
        console.warn('[DB Setup] Warning: Failed to clear tables during cleanup:', error);
      }
      
      // Note: We don't actually close the pool as it's shared across test suites
      // The pool will be closed when the test process exits
      console.log(`[DB Setup] Database cleanup completed for suite: ${stateKey}`);
    })();
    
    // Store cleanup promise
    const currentState = testDatabaseState.get(stateKey) || { initialized: false };
    testDatabaseState.set(stateKey, { ...currentState, cleanupPromise });
    
    // Use race to enforce timeout
    await Promise.race([cleanupPromise, cleanupTimeout]);
    
  } catch (error) {
    console.error(`[DB Setup] Error during database cleanup for suite ${stateKey}:`, error);
    // Don't throw here as it would interfere with test cleanup
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