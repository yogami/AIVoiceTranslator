import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DatabaseStorage } from '../../server/database-storage';
import { setupIsolatedTest, cleanupIsolatedTest } from '../utils/test-database-isolation';

describe('Translation Count Integration', () => {
  let storage: DatabaseStorage;

  beforeEach(async () => {
    storage = await setupIsolatedTest('translation-count.integration.test');
  });

  afterEach(async () => {
    await cleanupIsolatedTest('translation-count.integration.test');
  });

  it('should increment totalTranslations when a translation is saved to a session', async () => {
    // Create a session
    const session = await storage.createSession({
      sessionId: 'test-session-123',
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
      sessionId: 'non-existent-session',
      sourceLanguage: 'en',
      targetLanguage: 'es',
      originalText: 'Hello',
      translatedText: 'Hola'
    });

    // This should not cause any errors - just saves the translation
  });
});
