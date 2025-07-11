/**
 * Simple test to diagnose database persistence issues
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { DatabaseStorage } from '../../server/database-storage';
import { TestDatabaseManager } from '../utils/TestDatabaseManager';
import { setupTestIsolation } from '../../test-config/test-isolation';

describe('Database Persistence Diagnostic', () => {
  // Set up test isolation for this integration test suite
  setupTestIsolation('Database Persistence Diagnostic', 'integration');
  
  let storage: TestDatabaseManager;

  beforeEach(async () => {
    storage = new TestDatabaseManager();
    await storage.resetDatabase();
    await storage.initializeDefaultLanguages();
    console.log('[DEBUG] Reset completed in beforeEach');
  });

  it('should persist and retrieve a session immediately', async () => {
    const sessionId = 'diagnostic-session-' + Date.now();
    console.log('[TEST] Creating session:', sessionId);
    
    // Create session
    const createdSession = await storage.createSession({
      sessionId,
      teacherId: 'diagnostic-teacher-123',
      teacherLanguage: 'en-US',
      isActive: true
    });
    console.log('[TEST] Created session:', createdSession.id);
    
    // Immediately try to retrieve it
    const retrieved = await storage.getSessionById(sessionId);
    console.log('[TEST] Retrieved session:', retrieved ? retrieved.id : 'NOT FOUND');
    
    expect(retrieved).toBeDefined();
    expect(retrieved?.sessionId).toBe(sessionId);
  });

  it('should persist and retrieve a user immediately', async () => {
    const username = 'diagnostic-user-' + Date.now();
    console.log('[TEST] Creating user:', username);
    
    // Create user
    const createdUser = await storage.createUser({
      username,
      password: 'password123'
    });
    console.log('[TEST] Created user:', createdUser.id);
    
    // Immediately try to retrieve it
    const retrieved = await storage.getUserByUsername(username);
    console.log('[TEST] Retrieved user:', retrieved ? retrieved.id : 'NOT FOUND');
    
    expect(retrieved).toBeDefined();
    expect(retrieved?.username).toBe(username);
  });
});
