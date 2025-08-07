/**
 * Translation Service Interfaces
 * 
 * Central location for all translation and transcription service interfaces.
 * These interfaces define the contracts for clean architecture implementation.
 */

export interface TranslationResult {
  translatedText: string;
  detectedLanguage?: string;
  confidence?: number;
}

export interface ITranslationService {
  translate(text: string, targetLanguage: string, sourceLanguage?: string): Promise<string>;
}

export interface TranscriptionResult {
  text: string;
  confidence?: number;
  language?: string;
  duration?: number;
}

export interface ISTTTranscriptionService {
  transcribe(audioBuffer: Buffer, language?: string): Promise<string>;
}
