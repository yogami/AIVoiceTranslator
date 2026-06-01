/**
 * Translation Service Interfaces
 * 
 * Central location for all translation and transcription service interfaces.
 * These interfaces define the contracts for clean architecture implementation.
 */

export interface AgentAction {
  type: 'quiz' | 'vocabulary' | string;
  payload: any;
}

export interface TranslationResult {
  translatedText: string;
  detectedLanguage?: string;
  confidence?: number;
}

export interface ITranslationService {
  translate(text: string, sourceLanguage: string, targetLanguage: string): Promise<string | { text: string; agentActions?: AgentAction[] }>;
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
