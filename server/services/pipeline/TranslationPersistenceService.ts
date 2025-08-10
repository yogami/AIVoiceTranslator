/**
 * TranslationPersistenceService - Handles database persistence after successful delivery
 * Single Responsibility: Database operations and translation logging
 */

import type { WebSocketClient } from '../websocket/ConnectionManager';
import { DatabaseStorage } from '../../database-storage.js';
import logger from '../../logger';

export interface PersistenceParams {
  studentWs: WebSocketClient;
  studentLanguage: string;
  translation: string;
  originalText: string;
  sourceLanguage: string;
  sessionId?: string;
  getSessionId?: (ws: WebSocketClient) => string | undefined;
  latencyTracking: { start: number; components: { preparation: number; translation: number; tts: number; processing: number } };
}

export class TranslationPersistenceService {
  private readonly databaseStorage: DatabaseStorage;

  constructor() {
    this.databaseStorage = new DatabaseStorage();
  }

  /**
   * Persist translation to database after successful delivery to student.
   * This ensures we only persist translations that were actually delivered.
   */
  async persistTranslationAfterDelivery(params: PersistenceParams): Promise<void> {
    const enableDetailedTranslationLogging = process.env.ENABLE_DETAILED_TRANSLATION_LOGGING === 'true';
    if (!enableDetailedTranslationLogging) {
      logger.debug('TranslationPersistenceService: Detailed translation logging disabled, skipping persistence');
      return;
    }

    const {
      studentWs,
      studentLanguage,
      translation,
      originalText,
      sourceLanguage,
      sessionId,
      getSessionId,
      latencyTracking
    } = params;

    const studentSessionId = getSessionId?.(studentWs) || sessionId;
    if (!studentSessionId) {
      logger.warn('TranslationPersistenceService: No sessionId available for translation persistence', {
        hasGetSessionId: !!getSessionId,
        hasSessionId: !!sessionId
      });
      return;
    }

    const translationLatency = latencyTracking.components?.translation || 0;

    try {
      const translationData = {
        sessionId: studentSessionId,
        sourceLanguage: sourceLanguage,
        targetLanguage: studentLanguage,
        originalText: originalText,
        translatedText: translation,
        latency: translationLatency
      };

      await this.databaseStorage.addTranslation(translationData);
      logger.info('TranslationPersistenceService: Translation persisted after successful delivery', {
        sessionId: studentSessionId,
        sourceLanguage,
        targetLanguage: studentLanguage,
        latency: translationLatency
      });
    } catch (error) {
      logger.error('TranslationPersistenceService: Failed to persist translation after delivery', {
        error,
        sessionId: studentSessionId,
        sourceLanguage,
        targetLanguage: studentLanguage,
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      });
      // Don't throw - persistence failure shouldn't break the translation flow
    }
  }

  // Expose database storage for direct access (backward compatibility)
  get storage(): DatabaseStorage {
    return this.databaseStorage;
  }
}
