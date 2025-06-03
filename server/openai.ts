/**
 * OpenAI Service Facade
 * 
 * This module provides a clean, simplified interface to OpenAI-powered
 * transcription and translation services. It acts as a facade pattern
 * implementation, hiding the complexity of the underlying services.
 * 
 * Design Principles Applied:
 * - Facade Pattern: Simplifies complex subsystem interfaces
 * - DRY (Don't Repeat Yourself): Centralizes OpenAI service access
 * - Single Responsibility: Only responsible for exposing translation API
 */

import { translateSpeech as translateSpeechService } from './services/TranslationService';

/**
 * Result of a translation operation
 */
export interface TranslationResult {
  /** The original transcribed text from the audio */
  originalText: string;
  /** The translated text in the target language */
  translatedText: string;
  /** The original audio buffer (unchanged) */
  audioBuffer: Buffer;
}

/**
 * Error thrown when translation parameters are invalid
 */
export class TranslationParameterError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TranslationParameterError';
  }
}

/**
 * Validates translation parameters
 * @throws TranslationParameterError if parameters are invalid
 */
function validateTranslationParameters(
  audioBuffer: Buffer,
  sourceLanguage: string,
  targetLanguage: string
): void {
  if (!Buffer.isBuffer(audioBuffer)) {
    throw new TranslationParameterError('audioBuffer must be a valid Buffer instance');
  }

  if (!sourceLanguage || typeof sourceLanguage !== 'string') {
    throw new TranslationParameterError('sourceLanguage must be a non-empty string');
  }

  if (!targetLanguage || typeof targetLanguage !== 'string') {
    throw new TranslationParameterError('targetLanguage must be a non-empty string');
  }

  // Validate language code format (basic check)
  const languageCodePattern = /^[a-z]{2}(-[A-Z]{2})?$/;
  if (!languageCodePattern.test(sourceLanguage)) {
    throw new TranslationParameterError(
      `Invalid sourceLanguage format: ${sourceLanguage}. Expected format: 'en' or 'en-US'`
    );
  }

  if (!languageCodePattern.test(targetLanguage)) {
    throw new TranslationParameterError(
      `Invalid targetLanguage format: ${targetLanguage}. Expected format: 'en' or 'en-US'`
    );
  }
}

/**
 * Transcribe and translate speech using OpenAI Whisper and GPT models
 * 
 * This function provides a high-level interface to:
 * 1. Transcribe audio using OpenAI Whisper
 * 2. Translate the transcribed text using OpenAI GPT
 * 3. Return both the original and translated text
 * 
 * @param audioBuffer - Buffer containing audio data to transcribe (WAV format recommended)
 * @param sourceLanguage - Language code of the source audio (e.g., 'en-US', 'es', 'fr-FR')
 * @param targetLanguage - Language code to translate to (e.g., 'es-ES', 'de', 'ja-JP')
 * @param preTranscribedText - Optional pre-transcribed text to skip the transcription step
 * 
 * @returns Promise resolving to TranslationResult with original text, translated text, and audio buffer
 * 
 * @throws TranslationParameterError if input parameters are invalid
 * @throws Error if transcription or translation fails
 * 
 * @example
 * ```typescript
 * const audioBuffer = fs.readFileSync('speech.wav');
 * const result = await translateSpeech(audioBuffer, 'en-US', 'es-ES');
 * console.log(`Original: ${result.originalText}`);
 * console.log(`Translated: ${result.translatedText}`);
 * ```
 */
export async function translateSpeech(
  audioBuffer: Buffer, 
  sourceLanguage: string, 
  targetLanguage: string,
  preTranscribedText?: string
): Promise<TranslationResult> {
  // Validate input parameters
  validateTranslationParameters(audioBuffer, sourceLanguage, targetLanguage);

  // Optional: Validate preTranscribedText if provided
  if (preTranscribedText !== undefined && typeof preTranscribedText !== 'string') {
    throw new TranslationParameterError('preTranscribedText must be a string if provided');
  }

  try {
    // Delegate to the service implementation
    const result = await translateSpeechService(
      audioBuffer,
      sourceLanguage,
      targetLanguage,
      preTranscribedText
    );

    // Ensure the result has the expected shape
    if (!result || typeof result !== 'object') {
      throw new Error('Translation service returned invalid result');
    }

    return result;
  } catch (error) {
    // Re-throw parameter errors as-is
    if (error instanceof TranslationParameterError) {
      throw error;
    }

    // Wrap other errors with more context
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Translation failed: ${errorMessage}`);
  }
}