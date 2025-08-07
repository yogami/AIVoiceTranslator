/**
 * TranslationDeliveryService - Handles WebSocket delivery and TTS generation for students
 * Single Responsibility: Message delivery and client-specific processing
 */

import type { WebSocketClient } from '../websocket/ConnectionManager';
import type { ClientSettings, TranslationMessageToClient } from '../WebSocketTypes';
import type { ITTSService } from '../tts/TTSService';
import { AudioEncodingService } from '../audio/AudioEncodingService';
import logger from '../../logger';

export interface DeliveryParams {
  studentWs: WebSocketClient;
  studentLanguage: string;
  translation: string;
  originalText: string;
  sourceLanguage: string;
  sessionId?: string;
  getClientSettings: (ws: WebSocketClient) => ClientSettings | undefined;
  getSessionId?: (ws: WebSocketClient) => string | undefined;
  latencyTracking: { start: number; components: { preparation: number; translation: number; tts: number; processing: number } };
  ttsStartTime: number;
  startTime: number;
}

export interface DeliveryResult {
  studentWs: WebSocketClient;
  studentLanguage: string;
  delivered: boolean;
  error?: unknown;
}

export class TranslationDeliveryService {
  private readonly audioEncodingService: AudioEncodingService;

  constructor(
    private readonly ttsServiceFactory: (type: string) => ITTSService
  ) {
    this.audioEncodingService = new AudioEncodingService();
  }

  async deliverTranslation(params: DeliveryParams): Promise<boolean> {
    const {
      studentWs,
      studentLanguage,
      translation,
      originalText,
      sourceLanguage,
      sessionId,
      getClientSettings,
      getSessionId,
      latencyTracking,
      ttsStartTime,
      startTime
    } = params;

    const clientSettings = getClientSettings(studentWs) || {};
    const ttsServiceTypeFlag = clientSettings.ttsServiceType || process.env.TTS_SERVICE_TYPE || 'openai';
    const useClientSpeech = clientSettings.useClientSpeech === true;

    let audioData = '';
    let actualTTSServiceType = ttsServiceTypeFlag;
    let speechParams: { type: 'browser-speech'; text: string; languageCode: string; autoPlay: boolean } | undefined;

    if (useClientSpeech) {
      speechParams = {
        type: 'browser-speech',
        text: translation,
        languageCode: studentLanguage,
        autoPlay: true
      };
    } else {
      const audioResult = await this.generateTTSAudio(translation, studentLanguage, ttsServiceTypeFlag);
      audioData = audioResult.audioData;
      actualTTSServiceType = audioResult.ttsServiceType;
    }

    const ttsEndTime = Date.now();
    if (latencyTracking.components.tts === 0) {
      latencyTracking.components.tts = ttsEndTime - ttsStartTime;
    }

    const serverCompleteTime = Date.now();
    const totalLatency = serverCompleteTime - startTime;

    const translationMessage: TranslationMessageToClient = {
      type: 'translation',
      text: translation,
      originalText: originalText,
      sourceLanguage: sourceLanguage,
      targetLanguage: studentLanguage,
      ttsServiceType: actualTTSServiceType,
      latency: {
        total: totalLatency,
        serverCompleteTime: serverCompleteTime,
        components: latencyTracking.components
      },
      audioData: audioData,
      useClientSpeech: useClientSpeech,
      ...(speechParams && { speechParams })
    };

    // Retry delivery up to 3 times
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        studentWs.send(JSON.stringify(translationMessage));
        logger.info('Sent translation to student:', {
          studentLanguage,
          translation,
          originalText,
          ttsServiceType: actualTTSServiceType,
          useClientSpeech,
          totalLatency,
          hasAudio: audioData.length > 0,
          attempt
        });

        return true;
      } catch (error) {
        logger.error('Error sending translation to student:', {
          error,
          errorMessage: error instanceof Error ? error.message : String(error),
          errorStack: error instanceof Error ? error.stack : undefined,
          studentLanguage,
          attempt
        });
        if (attempt < 3) {
          logger.warn(`Retrying translation delivery for ${studentLanguage}, attempt ${attempt + 1}`);
        }
      }
    }
    return false;
  }

  private async generateTTSAudio(text: string, language: string, ttsServiceTypeFlag: string): Promise<{ audioData: string; ttsServiceType: string }> {
    try {
      const ttsService = this.ttsServiceFactory(ttsServiceTypeFlag);
      const ttsResult = await ttsService.synthesize(text, { language });
      
      // Handle browser TTS special case
      if (ttsResult.ttsServiceType === 'browser' && ttsResult.clientSideText) {
        // For browser TTS, encode client-side synthesis instructions
        const browserTTSInstructions = {
          type: 'browser-speech',
          text: ttsResult.clientSideText,
          languageCode: ttsResult.clientSideLanguage || language,
          autoPlay: true
        };
        
        const audioData = Buffer.from(JSON.stringify(browserTTSInstructions), 'utf8').toString('base64');
        return { 
          audioData, 
          ttsServiceType: 'browser' 
        };
      }
      
      // For other TTS services, encode the actual audio buffer
      const audioData = this.audioEncodingService.encodeToBase64(ttsResult.audioBuffer || Buffer.alloc(0));
      return { 
        audioData, 
        ttsServiceType: ttsResult.ttsServiceType || ttsServiceTypeFlag 
      };
    } catch (error) {
      logger.error('Error generating TTS audio:', {
        error,
        errorMessage: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined
      });
      console.error('[TranslationDeliveryService] TTS error:', error);
      
      if (ttsServiceTypeFlag === 'auto') {
        try {
          const fallbackTTSService = this.ttsServiceFactory('elevenlabs');
          const ttsResult = await fallbackTTSService.synthesize(text, { language });
          const audioData = this.audioEncodingService.encodeToBase64(ttsResult.audioBuffer || Buffer.alloc(0));
          return { 
            audioData, 
            ttsServiceType: ttsResult.ttsServiceType || 'elevenlabs' 
          };
        } catch (fallbackError) {
          logger.error('Error generating TTS audio with fallback:', {
            error: fallbackError,
            errorMessage: fallbackError instanceof Error ? fallbackError.message : String(fallbackError),
            errorStack: fallbackError instanceof Error ? fallbackError.stack : undefined
          });
          console.error('[TranslationDeliveryService] TTS fallback error:', fallbackError);
        }
      }
      return { audioData: '', ttsServiceType: ttsServiceTypeFlag };
    }
  }
}
