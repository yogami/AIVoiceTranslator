import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DatabaseStorage } from '../../server/database-storage';
import { setupIsolatedTest, cleanupIsolatedTest } from '../utils/test-database-isolation';
import { setupTestIsolation } from '../../test-config/test-isolation';
import { randomUUID } from 'crypto';

describe('Translation Count Integration', () => {
  // Set up test isolation for this integration test suite
  setupTestIsolation('Translation Count Integration', 'integration');
  
  let storage: DatabaseStorage;
  let testId: string;

  beforeEach(async () => {
    storage = new DatabaseStorage();
    testId = randomUUID();
  });

  afterEach(async () => {
    // Cleanup is handled by setupTestIsolation
  });

  it('should increment totalTranslations when a translation is saved to a session', async () => {
    // Create a session
    const session = await storage.createSession({
      sessionId: `test-session-123-${testId}`,
      teacherId: `teacher-translation-count-${testId}`,
      teacherLanguage: 'en'
    });

    expect(session.totalTranslations).toBe(0);

    // Add first translation
    await storage.addTranslation({
      sessionId: session.sessionId,
      sourceLanguage: 'en',
      targetLanguage: 'es',
      originalText: 'Hello',
      translatedText: 'Hola'
    });

    // Check session was updated
    const updatedSession1 = await storage.getSessionById(session.sessionId);
    expect(updatedSession1?.totalTranslations).toBe(1);

    // Add second translation
    await storage.addTranslation({
      sessionId: session.sessionId,
      sourceLanguage: 'en',
      targetLanguage: 'es',
      originalText: 'World',
      translatedText: 'Mundo'
    });

    // Check session was updated again
    const updatedSession2 = await storage.getSessionById(session.sessionId);
    expect(updatedSession2?.totalTranslations).toBe(2);
  });

  it('should not update totalTranslations for translations without sessionId', async () => {
    // Add translation without sessionId
    await storage.addTranslation({
      sourceLanguage: 'en',
      targetLanguage: 'es',
      originalText: 'Orphan translation',
      translatedText: 'Traducción huérfana'
    });

    // This should not cause any errors - just saves the translation
  });

  it('should handle non-existent sessionId gracefully', async () => {
    // Add translation with non-existent sessionId
    await storage.addTranslation({
      sessionId: `non-existent-session-${testId}`,
      sourceLanguage: 'en',
      targetLanguage: 'es',
      originalText: 'Hello',
      translatedText: 'Hola'
    });

    // This should not cause any errors - just saves the translation
  });
});
