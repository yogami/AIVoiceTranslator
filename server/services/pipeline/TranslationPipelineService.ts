/**
 * TranslationPipelineService - Handles the core STT -> Translation -> TTS pipeline
 * Single Responsibility: Pure business logic for translation processing
 */

import { ISTTTranscriptionService, ITranslationService } from '../translation/translation.interfaces';
import { ITTSService } from '../SpeechPipelineOrchestrator';
import logger from '../../logger';

export interface TranslationPipelineResult {
  originalText: string;
  translatedText: string;
  audioBuffer: Buffer;
  ttsServiceType?: string;
}

export interface TranslationPipelineInput {
  audioBuffer: Buffer;
  sourceLanguage: string;
  targetLanguage: string;
  preTranscribedText?: string;
  ttsServiceType?: string;
}

export class TranslationPipelineService {
  constructor(
    private readonly sttTranscriptionService: ISTTTranscriptionService,
    private readonly translationService: ITranslationService,
    private readonly ttsServiceFactory: (type: string) => ITTSService
  ) {}

  async process(input: TranslationPipelineInput): Promise<TranslationPipelineResult> {
    const { audioBuffer, sourceLanguage, targetLanguage, preTranscribedText, ttsServiceType } = input;

    // Step 1: Get original text (STT or use provided)
    const originalText = await this.getOriginalText(audioBuffer, sourceLanguage, preTranscribedText);
    if (!originalText) {
      return { originalText: '', translatedText: '', audioBuffer, ttsServiceType: undefined };
    }

    // Step 2: Translate text
    const translatedText = await this.getTranslation(originalText, sourceLanguage, targetLanguage);
    if (!translatedText) {
      return { originalText: '', translatedText: '', audioBuffer, ttsServiceType: undefined };
    }

    // Step 3: Generate TTS audio
    const { audioBuffer: ttsAudio, ttsServiceType: actualTtsType } = await this.getTTSAudio(
      translatedText, 
      targetLanguage, 
      ttsServiceType
    );

    return { 
      originalText, 
      translatedText, 
      audioBuffer: ttsAudio, 
      ttsServiceType: actualTtsType 
    };
  }

  private async getOriginalText(audioBuffer: Buffer, sourceLanguage: string, preTranscribedText?: string): Promise<string> {
    if (preTranscribedText) return preTranscribedText;
    
    try {
      return await this.sttTranscriptionService.transcribe(audioBuffer, sourceLanguage);
    } catch (error) {
      logger.error('Error in getOriginalText (first attempt):', {
        error,
        errorMessage: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined
      });
      console.error('[TranslationPipelineService] getOriginalText error:', error);
      
      // Retry once for fallback
      try {
        return await this.sttTranscriptionService.transcribe(audioBuffer, sourceLanguage);
      } catch (retryError) {
        logger.error('Error in getOriginalText (retry):', {
          error: retryError,
          errorMessage: retryError instanceof Error ? retryError.message : String(retryError),
          errorStack: retryError instanceof Error ? retryError.stack : undefined
        });
        console.error('[TranslationPipelineService] getOriginalText retry error:', retryError);
        return '';
      }
    }
  }

  private async getTranslation(originalText: string, sourceLanguage: string, targetLanguage: string): Promise<string> {
    try {
      return await this.translationService.translate(originalText, sourceLanguage, targetLanguage);
    } catch (error) {
      logger.error('Error in getTranslation:', {
        error,
        errorMessage: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined
      });
      console.error('[TranslationPipelineService] getTranslation error:', error);
      return '';
    }
  }

  private async getTTSAudio(text: string, language: string, ttsServiceType?: string): Promise<{ audioBuffer: Buffer; ttsServiceType?: string }> {
    let ttsType = ttsServiceType || 'openai';
    try {
      const ttsService = this.ttsServiceFactory(ttsType);
      const ttsResult = await ttsService.synthesize(text, { language });
      return { audioBuffer: ttsResult.audioBuffer, ttsServiceType: ttsResult.ttsServiceType || ttsType };
    } catch (error) {
      logger.error('Error in getTTSAudio (primary):', {
        error,
        errorMessage: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined
      });
      console.error('[TranslationPipelineService] getTTSAudio error:', error);
      
      if (this.ttsServiceFactory && ttsServiceType === 'auto') {
        try {
          const fallbackTTSService = this.ttsServiceFactory('elevenlabs');
          const ttsResult = await fallbackTTSService.synthesize(text, { language });
          return { audioBuffer: ttsResult.audioBuffer, ttsServiceType: ttsResult.ttsServiceType || 'elevenlabs' };
        } catch (fallbackError) {
          logger.error('Error in getTTSAudio (fallback):', {
            error: fallbackError,
            errorMessage: fallbackError instanceof Error ? fallbackError.message : String(fallbackError),
            errorStack: fallbackError instanceof Error ? fallbackError.stack : undefined
          });
          console.error('[TranslationPipelineService] getTTSAudio fallback error:', fallbackError);
        }
      }
      return { audioBuffer: Buffer.alloc(0), ttsServiceType: undefined };
    }
  }

  async translateAll(originalText: string, sourceLanguage: string, targetLanguages: string[]): Promise<Map<string, string>> {
    const translations = new Map<string, string>();
    for (const targetLanguage of targetLanguages) {
      try {
        const translated = await this.translationService.translate(originalText, sourceLanguage, targetLanguage);
        translations.set(targetLanguage, translated);
      } catch (error) {
        logger.error(`Translation failed for ${targetLanguage}:`, {
          error,
          errorMessage: error instanceof Error ? error.message : String(error),
          errorStack: error instanceof Error ? error.stack : undefined
        });
        translations.set(targetLanguage, originalText);
      }
    }
    return translations;
  }
}
