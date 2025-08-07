import { ISTTTranscriptionService, ITranslationService, TranslationResult } from './translation/translation.interfaces';
import type { WebSocketClient } from './websocket/ConnectionManager';
import type { ClientSettings, TranslationMessageToClient } from './WebSocketTypes';
import { TranslationPipelineService } from './pipeline/TranslationPipelineService';
import { TranslationDeliveryService } from './pipeline/TranslationDeliveryService';
import { TranslationPersistenceService } from './pipeline/TranslationPersistenceService';
import { audioTranscriptionService } from './stttranscription/AudioTranscriptionService';
import { getTranslationService } from './translation/TranslationServiceFactory';
import { getTTSService } from './tts/TTSServiceFactory';
import { ITTSService } from './tts/TTSService';
import logger from '../logger';

export interface SpeechPipelineOptions {
  studentConnections: WebSocketClient[];
  originalText: string;
  sourceLanguage: string;
  targetLanguages: string[];
  sessionId?: string;
  getClientSettings: (ws: WebSocketClient) => ClientSettings | undefined;
  getLanguage: (ws: WebSocketClient) => string | undefined;
  getSessionId?: (ws: WebSocketClient) => string | undefined;
  latencyTracking: { start: number; components: { preparation: number; translation: number; tts: number; processing: number } };
  startTime: number;
  ttsServiceType?: string;
}


export class SpeechPipelineOrchestrator {
  private readonly pipelineService: TranslationPipelineService;
  private readonly deliveryService: TranslationDeliveryService;
  private readonly persistenceService: TranslationPersistenceService;

  constructor(
    sttTranscriptionService: ISTTTranscriptionService,
    translationService: ITranslationService,
    ttsServiceFactory: (type: string) => ITTSService
  ) {
    // Compose services following SOLID principles
    this.pipelineService = new TranslationPipelineService(
      sttTranscriptionService,
      translationService,
      ttsServiceFactory
    );
    this.deliveryService = new TranslationDeliveryService(ttsServiceFactory);
    this.persistenceService = new TranslationPersistenceService();
  }

  /**
   * Factory method to create SpeechPipelineOrchestrator with default services
   * This removes speech processing configuration from WebSocketServer
   */
  static createWithDefaultServices(): SpeechPipelineOrchestrator {
    const sttService = {
      transcribe: (audioBuffer: Buffer, sourceLanguage: string) =>
        audioTranscriptionService.transcribeAudio(audioBuffer, sourceLanguage)
    };
    
    const translationService = getTranslationService();
    const ttsServiceFactory = (type: string) => getTTSService(type);
    
    return new SpeechPipelineOrchestrator(
      sttService,
      translationService,
      ttsServiceFactory
    );
  }

  /**
   * Orchestrate the full speech pipeline: STT -> Translation -> TTS
   * This method is for unit test compatibility and legacy API.
   */
  async process(
    audioBuffer: Buffer,
    sourceLanguage: string,
    targetLanguage: string,
    preTranscribedText?: string,
    options?: { ttsServiceType?: string }
  ): Promise<{
    originalText: string;
    translatedText: string;
    audioBuffer: Buffer;
    ttsServiceType?: string;
  }> {
    // Delegate to pipeline service - thin orchestrator pattern
    return await this.pipelineService.process({
      audioBuffer,
      sourceLanguage,
      targetLanguage,
      preTranscribedText,
      ttsServiceType: options?.ttsServiceType
    });
  }

  /**
   * Orchestrate sending translations to multiple students with delivery tracking and retry logic.
   * Implements the speech processing pipeline with clean architecture principles.
   * Note: Database persistence is handled after successful delivery.
   */
  async sendTranslationsToStudents(options: SpeechPipelineOptions): Promise<void> {
    const {
      studentConnections,
      originalText,
      sourceLanguage,
      targetLanguages,
      sessionId,
      getClientSettings,
      getLanguage,
      getSessionId,
      latencyTracking,
      startTime
    } = options;

    logger.info('SpeechPipelineOrchestrator: sendTranslationsToStudents started');
    const preparationEndTime = Date.now();
    latencyTracking.components.preparation = preparationEndTime - startTime;

    // Delegate translation to pipeline service
    const translations = await this.pipelineService.translateAll(originalText, sourceLanguage, targetLanguages);
    latencyTracking.components.translation = Date.now() - preparationEndTime;

    // Deliver to each student using delivery service
    const ttsStartTime = Date.now();
    const deliveryResults: { studentWs: WebSocketClient; studentLanguage: string; delivered: boolean; error?: unknown }[] = [];
    
    const translationPromises = studentConnections.map(async (studentWs: WebSocketClient) => {
      const studentLanguage = getLanguage(studentWs);
      if (!studentLanguage || typeof studentLanguage !== 'string' || studentLanguage.trim().length === 0) {
        logger.warn('Student has no valid language set, skipping translation', {
          sessionId: getSessionId ? getSessionId(studentWs) : 'unknown',
          studentLanguage
        });
        deliveryResults.push({ studentWs, studentLanguage: studentLanguage || '', delivered: false, error: 'Invalid language' });
        return;
      }

      // Delegate delivery to delivery service
      const delivered = await this.deliveryService.deliverTranslation({
        studentWs,
        studentLanguage,
        translation: translations.get(studentLanguage) || originalText,
        originalText,
        sourceLanguage,
        sessionId,
        getClientSettings,
        getSessionId,
        latencyTracking,
        ttsStartTime,
        startTime
      });

      deliveryResults.push({ studentWs, studentLanguage, delivered });

      if (delivered) {
        // Delegate persistence to persistence service after successful delivery
        await this.persistenceService.persistTranslationAfterDelivery({
          studentWs,
          studentLanguage,
          translation: translations.get(studentLanguage) || originalText,
          originalText,
          sourceLanguage,
          sessionId,
          getSessionId,
          latencyTracking
        });
      } else {
        logger.error('CRITICAL: Translation delivery failed for student after 3 attempts', {
          studentLanguage,
          sessionId: getSessionId ? getSessionId(studentWs) : sessionId || 'unknown'
        });
      }
    });

    logger.info('SpeechPipelineOrchestrator: Awaiting all translation deliveries before session cleanup');
    await Promise.all(translationPromises);

    const failedDeliveries = deliveryResults.filter(r => !r.delivered);
    if (failedDeliveries.length > 0) {
      logger.error('Summary: Some students did not receive translations after retries', {
        failedStudents: failedDeliveries.map(r => ({ studentLanguage: r.studentLanguage, error: r.error }))
      });
    } else {
      logger.info('Summary: All students received translations successfully');
    }
    logger.info('SpeechPipelineOrchestrator: sendTranslationsToStudents finished (all translations sent, safe for cleanup)');
  }

  // Backward compatibility: Expose database storage for tests
  get databaseStorage() {
    return this.persistenceService.storage;
  }
}
