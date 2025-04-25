/**
 * OpenAI Service - Transcription and Translation
 * 
 * This file serves as a facade for the TranslationService
 * Implements Pragmatic Principle #11: Don't Repeat Yourself
 */

import { translateSpeech as translateSpeechService } from './services/TranslationService';

// Re-export the TranslationResult interface
export interface TranslationResult {
  originalText: string;
  translatedText: string;
  audioBuffer: Buffer;
}

/**
 * Transcribe and translate speech using OpenAI Whisper and GPT models
 * 
 * @param audioBuffer - Buffer containing audio data to transcribe
 * @param sourceLanguage - Language code of the source audio
 * @param targetLanguage - Language code to translate to
 * @param preTranscribedText - (Optional) If you already have the transcribed text, provide it to skip transcription
 * @returns - Object containing original text, translated text and audio buffer
 */
export async function translateSpeech(
  audioBuffer: Buffer, 
  sourceLanguage: string, 
  targetLanguage: string,
  preTranscribedText?: string
): Promise<TranslationResult> {
  // Delegate to the service implementation
  return translateSpeechService(
    audioBuffer,
    sourceLanguage,
    targetLanguage,
    preTranscribedText
  );
}