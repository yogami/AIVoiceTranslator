/**
 * Translation Service
 * 
 * This service is responsible for transcribing and translating speech.
 * It applies the following principles:
 * - Single Responsibility Principle (SRP): Each class has one job
 * - Open/Closed Principle: Open for extension, closed for modification
 * - Interface Segregation: Clients depend only on what they need
 * - Dependency Inversion: Depend on abstractions
 * - Pragmatic Principle #11: DRY - Don't Repeat Yourself
 * - Pragmatic Principle #13: Eliminate Effects Between Unrelated Things
 * - Pragmatic Principle #17: Program Close to the Problem Domain
 */

import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import OpenAI from 'openai';
import { storage } from '../storage';
import { textToSpeechService, ttsFactory } from './TextToSpeechService';

// Promisify file system operations
const writeFile = promisify(fs.writeFile);
const unlink = promisify(fs.unlink);
const stat = promisify(fs.stat);

// Constants for configuration
const TEMP_DIR = '/home/runner/workspace';
const DEFAULT_WHISPER_MODEL = 'whisper-1';
const DEFAULT_CHAT_MODEL = 'gpt-4o'; // the newest OpenAI model is "gpt-4o" which was released May 13, 2024

// Language maps for better domain representation
const LANGUAGE_MAP: Record<string, string> = {
  'en-US': 'English',
  'fr-FR': 'French',
  'es-ES': 'Spanish',
  'de-DE': 'German',
  'it-IT': 'Italian',
  'ja-JP': 'Japanese',
  'ko-KR': 'Korean',
  'pt-BR': 'Portuguese',
  'ru-RU': 'Russian',
  'zh-CN': 'Chinese (Simplified)',
  'ar-SA': 'Arabic',
  'hi-IN': 'Hindi',
  'tr-TR': 'Turkish',
  'nl-NL': 'Dutch',
  'pl-PL': 'Polish',
  'sv-SE': 'Swedish',
  'da-DK': 'Danish',
  'fi-FI': 'Finnish',
  'no-NO': 'Norwegian',
  'cs-CZ': 'Czech',
  'hu-HU': 'Hungarian',
  'el-GR': 'Greek',
  'he-IL': 'Hebrew',
  'th-TH': 'Thai',
  'vi-VN': 'Vietnamese',
  'id-ID': 'Indonesian',
  'ms-MY': 'Malay',
  'ro-RO': 'Romanian',
  'uk-UA': 'Ukrainian',
  'bg-BG': 'Bulgarian',
  'hr-HR': 'Croatian',
  'sr-RS': 'Serbian',
  'sk-SK': 'Slovak',
  'sl-SI': 'Slovenian',
  'et-EE': 'Estonian',
  'lv-LV': 'Latvian',
  'lt-LT': 'Lithuanian'
};

// Suspicious phrases that indicate prompt leakage
const SUSPICIOUS_PHRASES = [
  "If there is no speech or only background noise, return an empty string",
  "This is classroom speech from a teacher",
  "Transcribe any audible speech accurately",
  "return an empty string"
];

/**
 * Result interface for translation operations
 */
export interface TranslationResult {
  originalText: string;
  translatedText: string;
  audioBuffer: Buffer;
}

/**
 * Interface for a transcription service
 * Following Interface Segregation Principle
 */
export interface ITranscriptionService {
  transcribe(audioBuffer: Buffer, sourceLanguage: string): Promise<string>;
}

/**
 * Interface for a translation service
 * Following Interface Segregation Principle
 */
export interface ITranslationService {
  translate(text: string, sourceLanguage: string, targetLanguage: string): Promise<string>;
}

/**
 * Audio file handler for temporary file operations
 * Following Single Responsibility Principle
 */
class AudioFileHandler {
  private readonly tempDir: string;
  
  constructor(tempDir: string = TEMP_DIR) {
    this.tempDir = tempDir;
  }
  
  /**
   * Create a temporary file from an audio buffer
   */
  async createTempFile(audioBuffer: Buffer): Promise<string> {
    const filePath = path.join(this.tempDir, `temp-audio-${Date.now()}.wav`);
    
    try {
      await writeFile(filePath, audioBuffer);
      console.log(`Saved audio buffer to temporary file: ${filePath}`);
      
      const fileStats = await stat(filePath);
      console.log(`Audio file size: ${fileStats.size} bytes, created: ${fileStats.mtime}`);
      console.log(`Audio duration estimate: ~${Math.round(fileStats.size / 16000 / 2)} seconds`);
      
      return filePath;
    } catch (error) {
      console.error('Error creating temporary audio file:', error);
      throw new Error('Failed to create temporary audio file');
    }
  }
  
  /**
   * Delete a temporary file
   */
  async deleteTempFile(filePath: string): Promise<void> {
    try {
      await unlink(filePath);
      console.log(`Deleted temporary file: ${filePath}`);
    } catch (error) {
      console.error('Error cleaning up temporary file:', error);
      // Don't throw here - cleaning up is a best effort
    }
  }
}

/**
 * OpenAI Whisper Transcription Service
 * Handles audio transcription using OpenAI's Whisper API
 */
export class OpenAITranscriptionService implements ITranscriptionService {
  private readonly openai: OpenAI;
  private readonly audioHandler: AudioFileHandler;
  
  constructor(
    openai: OpenAI,
    audioHandler: AudioFileHandler = new AudioFileHandler()
  ) {
    this.openai = openai;
    this.audioHandler = audioHandler;
  }
  
  /**
   * Validate if audio buffer is suitable for transcription
   */
  private validateAudioBuffer(audioBuffer: Buffer): boolean {
    if (!audioBuffer || audioBuffer.length < 1000) {
      console.log(`Audio buffer too small for transcription: ${audioBuffer?.length} bytes`);
      return false;
    }
    
    console.log(`Transcribing audio buffer of size ${audioBuffer.length}...`);
    console.log(`Audio buffer header (hex): ${audioBuffer.slice(0, 32).toString('hex')}`);
    console.log(`Audio buffer has valid WAV header: ${audioBuffer.slice(0, 4).toString() === 'RIFF'}`);
    
    return true;
  }
  
  /**
   * Extract primary language code from full language code
   */
  private extractPrimaryLanguage(sourceLanguage: string): string {
    // Extract the primary language code (e.g., 'en' from 'en-US')
    return sourceLanguage.split('-')[0];
  }
  
  /**
   * Call OpenAI Whisper API to transcribe audio
   */
  private async callWhisperAPI(audioReadStream: fs.ReadStream, language: string): Promise<string> {
    console.log('Sending read stream to OpenAI API');
    console.log('Using minimal parameters with no prompt to avoid preconceptions');
    
    const transcriptionResponse = await this.openai.audio.transcriptions.create({
      file: audioReadStream,
      model: DEFAULT_WHISPER_MODEL,
      language: language,
      response_format: 'json'
    });
    
    // Log the full response for debugging
    console.log(`Full transcription response: ${JSON.stringify(transcriptionResponse)}`);
    
    return transcriptionResponse.text || '';
  }
  
  /**
   * Validate transcription text for prompt leakage or other issues
   */
  private validateTranscriptionText(text: string): { isValid: boolean, cleanedText: string } {
    if (!text) {
      console.log('Transcription returned no text - Whisper API failed to detect speech');
      return { isValid: false, cleanedText: '' };
    }
    
    console.log(`Transcription successful: { text: '${text}' }`);
    console.log(`📢 DIAGNOSTIC - EXACT TRANSCRIPTION FROM OPENAI: "${text}"`);
    
    // Check for potential prompt leakage
    const isPotentialPromptLeak = SUSPICIOUS_PHRASES.some(phrase => 
      text.includes(phrase)
    );
    
    if (isPotentialPromptLeak) {
      console.log('⚠️ DETECTED PROMPT LEAKAGE: The transcription appears to contain prompt instructions');
      console.log('Treating this as an empty transcription and triggering fallback mechanism');
      return { isValid: false, cleanedText: '' };
    }
    
    return { isValid: true, cleanedText: text };
  }
  
  /**
   * Transcribe audio using OpenAI Whisper API
   */
  async transcribe(audioBuffer: Buffer, sourceLanguage: string): Promise<string> {
    if (!this.validateAudioBuffer(audioBuffer)) {
      return '';
    }
    
    let tempFilePath = '';
    
    try {
      // Create temporary file from audio buffer
      tempFilePath = await this.audioHandler.createTempFile(audioBuffer);
      
      // Create stream from file
      const audioReadStream = fs.createReadStream(tempFilePath);
      
      // Extract the primary language code and call Whisper API
      const primaryLanguage = this.extractPrimaryLanguage(sourceLanguage);
      const transcriptionText = await this.callWhisperAPI(audioReadStream, primaryLanguage);
      
      // Validate the transcription result
      const { isValid, cleanedText } = this.validateTranscriptionText(transcriptionText);
      return isValid ? cleanedText : '';
    } catch (error: unknown) {
      console.error('Error during transcription:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Transcription failed: ${errorMessage}`);
    } finally {
      // Clean up the temporary file
      if (tempFilePath) {
        await this.audioHandler.deleteTempFile(tempFilePath);
      }
    }
  }
}

/**
 * Error response interface for standardized error handling
 */
interface TranslationErrorResponse {
  error: string;
  originalText: string;
  retryCount: number;
  statusCode?: number;
  shouldRetry: boolean;
}

/**
 * OpenAI Translation Service
 * Handles text translation using OpenAI's GPT API
 * Implements proper error handling with retry logic
 */
export class OpenAITranslationService implements ITranslationService {
  private readonly openai: OpenAI;
  private readonly maxRetries: number = 3;
  
  constructor(openai: OpenAI) {
    this.openai = openai;
  }
  
  /**
   * Get the full language name from a language code
   */
  private getLanguageName(languageCode: string): string {
    return LANGUAGE_MAP[languageCode] || languageCode.split('-')[0];
  }
  
  /**
   * Extract error message from unknown error type
   */
  private extractErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    return 'Unknown error occurred';
  }
  
  /**
   * Extract status code from error if available
   */
  private extractStatusCode(error: unknown): number | undefined {
    if (error instanceof Error && 'status' in error && typeof (error as any).status === 'number') {
      return (error as any).status;
    }
    return undefined;
  }
  
  /**
   * Determine if retry should be attempted based on error type and retry count
   */
  private shouldAttemptRetry(statusCode: number | undefined, retryCount: number): boolean {
    if (retryCount >= this.maxRetries) {
      return false;
    }
    
    // If no status code, use default retry logic
    if (statusCode === undefined) {
      return true;
    }
    
    // Only retry on specific error codes (429 rate limit, 500 server error, etc.)
    return statusCode === 429 || statusCode >= 500;
  }
  
  /**
   * Log error information for debugging and monitoring
   */
  private logTranslationError(errorMessage: string, retryCount: number): void {
    console.error(`Translation error [attempt ${retryCount + 1}/${this.maxRetries + 1}]:`, errorMessage);
  }
  
  /**
   * Handle translation errors in a standardized way
   * Extracts useful information from various error types
   */
  private handleTranslationError(error: unknown, originalText: string, retryCount: number): TranslationErrorResponse {
    const errorMessage = this.extractErrorMessage(error);
    const statusCode = this.extractStatusCode(error);
    const shouldRetry = this.shouldAttemptRetry(statusCode, retryCount);
    
    this.logTranslationError(errorMessage, retryCount);
    
    return {
      error: errorMessage,
      originalText,
      retryCount,
      statusCode,
      shouldRetry
    };
  }
  
  /**
   * Create a translation prompt with consistent formatting
   */
  private createTranslationPrompt(text: string, sourceLangName: string, targetLangName: string): string {
    return `
      Translate this text from ${sourceLangName} to ${targetLangName}. 
      Maintain the same tone and style. Return only the translation without explanations or notes.
      
      Original text: "${text}"
      
      Translation:
    `;
  }

  /**
   * Call OpenAI API to translate text
   */
  private async callOpenAITranslationAPI(prompt: string): Promise<string> {
    const translation = await this.openai.chat.completions.create({
      model: DEFAULT_CHAT_MODEL,
      messages: [
        { role: 'system', content: 'You are a professional translator with expertise in multiple languages.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.1,
      max_tokens: 500
    });
    
    return translation.choices[0].message.content?.trim() || '';
  }
  
  /**
   * Implement exponential backoff delay for retries
   */
  private async performRetryDelay(retryCount: number): Promise<void> {
    const delay = Math.pow(2, retryCount) * 1000; // Exponential backoff
    console.log(`Retrying translation in ${delay}ms...`);
    
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  /**
   * Create translation request with exponential backoff retry
   */
  private async executeWithRetry(
    text: string,
    sourceLangName: string,
    targetLangName: string,
    retryCount: number = 0
  ): Promise<string> {
    try {
      const prompt = this.createTranslationPrompt(text, sourceLangName, targetLangName);
      const translatedText = await this.callOpenAITranslationAPI(prompt);
      return translatedText || text; // Fallback to original text if translation is empty
    } catch (error) {
      const errorResponse = this.handleTranslationError(error, text, retryCount);
      
      if (errorResponse.shouldRetry) {
        await this.performRetryDelay(retryCount);
        return this.executeWithRetry(text, sourceLangName, targetLangName, retryCount + 1);
      }
      
      // If we've exhausted retries or shouldn't retry, throw a standardized error
      throw new Error(`Translation failed after ${retryCount + 1} attempts: ${errorResponse.error}`);
    }
  }
  
  /**
   * Translate text from one language to another
   * Implementation now has reduced complexity by separating concerns
   */
  async translate(
    text: string, 
    sourceLanguage: string, 
    targetLanguage: string
  ): Promise<string> {
    // Skip translation for empty text
    if (!text) {
      return '';
    }
    
    // If target language is the same as source language, no translation needed
    if (targetLanguage === sourceLanguage) {
      console.log(`No translation needed - source and target language are the same (${targetLanguage})`);
      return text;
    }
    
    try {
      const sourceLangName = this.getLanguageName(sourceLanguage);
      const targetLangName = this.getLanguageName(targetLanguage);
      
      const translatedText = await this.executeWithRetry(text, sourceLangName, targetLangName);
      
      console.log(`Successfully processed translation to ${targetLanguage}`);
      console.log(`Translation complete: "${text}" -> "${translatedText}"`);
      
      return translatedText;
    } catch (error: unknown) {
      console.error(`Error translating to ${targetLanguage}:`, error);
      
      // For production, we'd log this error to a monitoring system
      if (error instanceof Error) {
        console.error(`Translation error details: ${error.message}`);
      }
      
      // Return empty string to indicate failure, better than returning misleading text
      return '';
    }
  }
}

/**
 * Helper for creating development mode audio buffers
 * Extracted to reduce complexity in main service class
 */
class DevelopmentModeHelper {
  /**
   * Create a simple WAV buffer with silence
   * Used for development mode when no real audio processing is available
   */
  static createSilentAudioBuffer(): Buffer {
    // Create a minimal PCM WAV header
    const wavHeader = Buffer.from([
      0x52, 0x49, 0x46, 0x46, // "RIFF"
      0x24, 0x00, 0x00, 0x00, // ChunkSize (36 bytes + data size)
      0x57, 0x41, 0x56, 0x45, // "WAVE"
      0x66, 0x6d, 0x74, 0x20, // "fmt "
      0x10, 0x00, 0x00, 0x00, // Subchunk1Size (16 bytes)
      0x01, 0x00,             // AudioFormat (1 = PCM)
      0x01, 0x00,             // NumChannels (1 = mono)
      0x44, 0xac, 0x00, 0x00, // SampleRate (44100 Hz)
      0x88, 0x58, 0x01, 0x00, // ByteRate (SampleRate * NumChannels * BitsPerSample/8)
      0x02, 0x00,             // BlockAlign (NumChannels * BitsPerSample/8)
      0x10, 0x00,             // BitsPerSample (16 bits)
      0x64, 0x61, 0x74, 0x61, // "data"
      0x00, 0x00, 0x00, 0x00  // Subchunk2Size (data size)
    ]);
    
    // Add some silence (1 second)
    const sampleCount = 44100;
    const dataSize = sampleCount * 2; // 16-bit samples
    const silenceData = Buffer.alloc(dataSize);
    
    // Update the data chunk size in the header
    wavHeader.writeUInt32LE(dataSize, 40);
    // Update the overall file size in the header
    wavHeader.writeUInt32LE(36 + dataSize, 4);
    
    // Combine header and data
    return Buffer.concat([wavHeader, silenceData]);
  }
  
  /**
   * Get a synthetic translation based on target language
   */
  static getLanguageSpecificTranslation(text: string, targetLanguage: string): string {
    // Simple mapping for common languages in development mode
    const devTranslations: Record<string, string> = {
      es: 'Esto es una traducción en modo de desarrollo.',
      fr: 'Ceci est une traduction en mode développement.',
      de: 'Dies ist eine Übersetzung im Entwicklungsmodus.',
    };
    
    // Extract language code without region (e.g., 'es' from 'es-ES')
    const langPrefix = targetLanguage.split('-')[0].toLowerCase();
    
    // Return mapped translation or original text if no mapping exists
    return devTranslations[langPrefix] || text;
  }
}

/**
 * Composite Speech Translation Service
 * Orchestrates the entire translation workflow
 * Following the Facade pattern and Strategy pattern to simplify the API
 */
export class SpeechTranslationService {
  private readonly transcriptionService: ITranscriptionService;
  private readonly translationService: ITranslationService;
  private readonly apiKeyAvailable: boolean;
  
  constructor(
    transcriptionService: ITranscriptionService,
    translationService: ITranslationService,
    apiKeyAvailable: boolean
  ) {
    this.transcriptionService = transcriptionService;
    this.translationService = translationService;
    this.apiKeyAvailable = apiKeyAvailable;
  }
  
  /**
   * Create development mode synthetic translation for testing without API key
   */
  private createDevelopmentModeTranslation(
    sourceLanguage: string,
    targetLanguage: string,
    preTranscribedText?: string
  ): TranslationResult {
    console.log('DEV MODE: Using synthetic translation data due to missing API key');
    
    // Get the transcription from WebSpeech API if available
    const originalText = preTranscribedText || 'This is a development mode transcription.';
    
    // Get language-specific translation
    const translatedText = DevelopmentModeHelper.getLanguageSpecificTranslation(
      originalText, 
      targetLanguage
    );
    
    // Create a simple audio buffer with silence
    const audioBuffer = DevelopmentModeHelper.createSilentAudioBuffer();
    
    console.log(`DEV MODE: Returning synthetic translation: "${translatedText}"`);
    
    return {
      originalText,
      translatedText,
      audioBuffer
    };
  }
  
  /**
   * Get text either from pre-transcribed input or by transcribing audio
   * Extracted to reduce complexity
   */
  private async getOriginalText(
    audioBuffer: Buffer,
    sourceLanguage: string,
    preTranscribedText?: string
  ): Promise<string> {
    // If text is already provided, skip transcription step
    if (preTranscribedText) {
      console.log(`Using pre-transcribed text instead of audio: "${preTranscribedText}"`);
      return preTranscribedText;
    }
    
    // Transcribe the audio
    try {
      return await this.transcriptionService.transcribe(audioBuffer, sourceLanguage);
    } catch (error: unknown) {
      console.error('Transcription service failed:', error);
      return '';
    }
  }
  
  /**
   * Translate text to target language
   * Extracted to reduce complexity
   */
  private async translateText(
    text: string,
    sourceLanguage: string,
    targetLanguage: string
  ): Promise<string> {
    try {
      return await this.translationService.translate(
        text,
        sourceLanguage,
        targetLanguage
      );
    } catch (error) {
      console.error('Translation service failed:', error);
      return '';
    }
  }
  
  /**
   * Check if development mode should be used (no API key)
   */
  private shouldUseDevelopmentMode(): boolean {
    return !this.apiKeyAvailable;
  }

  /**
   * Log start of speech translation process
   */
  private logTranslationStart(sourceLanguage: string, targetLanguage: string): void {
    console.log(`Processing speech translation from ${sourceLanguage} to ${targetLanguage}`);
  }

  /**
   * Prepare text for audio generation, using translated text or fallback
   */
  private prepareTextForAudio(translatedText: string, originalText: string): string {
    return translatedText || originalText; // Use original if translation failed
  }

  /**
   * Transcribe and translate speech
   * Main public method that orchestrates the workflow
   */
  async translateSpeech(
    audioBuffer: Buffer,
    sourceLanguage: string,
    targetLanguage: string,
    preTranscribedText?: string,
    options?: { ttsServiceType?: string }
  ): Promise<TranslationResult> {
    this.logTranslationStart(sourceLanguage, targetLanguage);
    
    // DEVELOPMENT MODE: Check if API key is missing
    if (this.shouldUseDevelopmentMode()) {
      return this.createDevelopmentModeTranslation(sourceLanguage, targetLanguage, preTranscribedText);
    }
    
    // Get original text (either from transcription or pre-provided)
    const originalText = await this.getOriginalText(audioBuffer, sourceLanguage, preTranscribedText);
    
    // Skip empty transcriptions
    if (!originalText) {
      return this.createEmptyTranslationResult(audioBuffer);
    }
    
    // Translate the text
    const translatedText = await this.translateText(originalText, sourceLanguage, targetLanguage);
    
    // Prepare text for audio generation
    const textForAudio = this.prepareTextForAudio(translatedText, originalText);
    
    // Generate speech audio with the translated text
    const translatedAudioBuffer = await this.generateTranslatedAudio(
      textForAudio,
      targetLanguage,
      audioBuffer,
      options
    );
    
    return this.createTranslationResult(originalText, translatedText, translatedAudioBuffer);
  }
  
  /**
   * Creates an empty translation result when original text is missing
   */
  private createEmptyTranslationResult(audioBuffer: Buffer): TranslationResult {
    return { 
      originalText: '', 
      translatedText: '', 
      audioBuffer 
    };
  }
  
  /**
   * Creates the final translation result object
   */
  private createTranslationResult(
    originalText: string,
    translatedText: string | undefined,
    audioBuffer: Buffer
  ): TranslationResult {
    return { 
      originalText, 
      translatedText: translatedText || originalText, // Fallback to original text if translation failed
      audioBuffer
    };
  }
  
  /**
   * Prepares and sends the request to the TTS service
   */
  private async callTTSService(text: string, targetLanguage: string, ttsServiceType: string): Promise<Buffer> {
    return await textToSpeechService.synthesizeSpeech({
      text: text,
      languageCode: targetLanguage,
      preserveEmotions: true // Enable emotional tone preservation
    }, ttsServiceType); // Pass service type explicitly
  }
  
  /**
   * Generates audio for the translated text using the specified TTS service
   */
  private async generateTranslatedAudio(
    text: string,
    targetLanguage: string,
    fallbackAudioBuffer: Buffer,
    options?: { ttsServiceType?: string }
  ): Promise<Buffer> {
    // Default to original audio if anything fails
    let translatedAudioBuffer = fallbackAudioBuffer;
    
    try {
      // Determine which TTS service to use
      const ttsServiceType = this.determineTTSServiceType(options);
      
      // Log TTS service selection in development mode
      this.logTTSServiceSelection(ttsServiceType, targetLanguage);
      
      // Generate audio using the selected TTS service
      translatedAudioBuffer = await this.callTTSService(text, targetLanguage, ttsServiceType);
      
      // Log audio generation success in development mode
      this.logAudioGenerationSuccess(translatedAudioBuffer, ttsServiceType);
    } catch (error) {
      console.error('Error generating audio for translation:', error);
      // On error, keep the original audio buffer
    }
    
    return translatedAudioBuffer;
  }
  
  /**
   * Determines which TTS service to use based on options or environment defaults
   */
  private determineTTSServiceType(options?: { ttsServiceType?: string }): string {
    return (options?.ttsServiceType) || process.env.TTS_SERVICE_TYPE || 'openai';
  }
  
  /**
   * Logs TTS service selection in development mode
   */
  private logTTSServiceSelection(ttsServiceType: string, targetLanguage: string): void {
    if (process.env.NODE_ENV === 'development') {
      console.log(`Translation service: Selected TTS type ${ttsServiceType} for language ${targetLanguage}`);
    }
  }
  
  /**
   * Logs audio generation success in development mode
   */
  private logAudioGenerationSuccess(audioBuffer: Buffer, ttsServiceType: string): void {
    if (process.env.NODE_ENV === 'development') {
      console.log(`Generated audio (${audioBuffer.length} bytes) using ${ttsServiceType} service`);
    }
  }
}

// Initialize OpenAI client with API key from environment
console.log(`OpenAI API key status: ${process.env.OPENAI_API_KEY ? 'Present' : 'Missing'}`);
if (!process.env.OPENAI_API_KEY) {
  console.error('OPENAI_API_KEY is missing or empty. This might cause API failures.');
}

// Create singleton instance with safe initialization pattern
let openai: OpenAI;
try {
  openai = new OpenAI({ 
    apiKey: process.env.OPENAI_API_KEY || 'sk-placeholder-for-initialization-only' 
  });
  console.log('OpenAI client initialized successfully');
} catch (error) {
  console.error('Error initializing OpenAI client:', error);
  // Create a placeholder client that will throw proper errors when methods are called
  openai = new OpenAI({ apiKey: 'sk-placeholder-for-initialization-only' });
}

// Create service instances
const audioHandler = new AudioFileHandler();
const transcriptionService = new OpenAITranscriptionService(openai, audioHandler);
const translationService = new OpenAITranslationService(openai);

// Create and export the main service facade
export const speechTranslationService = new SpeechTranslationService(
  transcriptionService,
  translationService,
  Boolean(process.env.OPENAI_API_KEY)
);

/**
 * Format TTS service options to handle both string and object formats
 * @param ttsServiceType The TTS service type as string or object
 * @returns Formatted TTS service options
 */
function formatTTSServiceOptions(ttsServiceType?: string | { ttsServiceType?: string }): { ttsServiceType?: string } {
  if (typeof ttsServiceType === 'string') {
    return { ttsServiceType };
  }
  return ttsServiceType || {};
}

/**
 * Log TTS service selection in development mode
 * @param ttsServiceOptions The TTS service options
 */
function logTTSServiceSelection(ttsServiceOptions: { ttsServiceType?: string }): void {
  if (process.env.NODE_ENV === 'development') {
    console.log(`Using TTS service: ${ttsServiceOptions.ttsServiceType || 'default'}`);
  }
}

// Export the legacy function for backward compatibility
export async function translateSpeech(
  audioBuffer: Buffer, 
  sourceLanguage: string, 
  targetLanguage: string,
  preTranscribedText?: string,
  ttsServiceType?: string | { ttsServiceType?: string }
): Promise<TranslationResult> {
  // Format options and log service selection
  const ttsServiceOptions = formatTTSServiceOptions(ttsServiceType);
  logTTSServiceSelection(ttsServiceOptions);
  
  // Call the actual service implementation
  return speechTranslationService.translateSpeech(
    audioBuffer,
    sourceLanguage,
    targetLanguage,
    preTranscribedText,
    ttsServiceOptions
  );
}