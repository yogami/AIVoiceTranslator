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
   * Transcribe audio using OpenAI Whisper API
   */
  async transcribe(audioBuffer: Buffer, sourceLanguage: string): Promise<string> {
    // Skip transcription for empty or tiny audio buffers
    if (!audioBuffer || audioBuffer.length < 1000) {
      console.log(`Audio buffer too small for transcription: ${audioBuffer?.length} bytes`);
      return '';
    }
    
    console.log(`Transcribing audio buffer of size ${audioBuffer.length}...`);
    console.log(`Audio buffer header (hex): ${audioBuffer.slice(0, 32).toString('hex')}`);
    console.log(`Audio buffer has valid WAV header: ${audioBuffer.slice(0, 4).toString() === 'RIFF'}`);
    
    let tempFilePath = '';
    
    try {
      // Create temporary file from audio buffer
      tempFilePath = await this.audioHandler.createTempFile(audioBuffer);
      
      // Create stream from file
      const audioReadStream = fs.createReadStream(tempFilePath);
      console.log('Sending read stream to OpenAI API');
      
      // Use minimal parameters to avoid hallucination issues
      console.log('Using minimal parameters with no prompt to avoid preconceptions');
      
      // Extract the primary language code (e.g., 'en' from 'en-US')
      const primaryLanguage = sourceLanguage.split('-')[0];
      
      // Transcribe with OpenAI Whisper API
      const transcriptionResponse = await this.openai.audio.transcriptions.create({
        file: audioReadStream,
        model: DEFAULT_WHISPER_MODEL,
        language: primaryLanguage,
        response_format: 'json'
      });
      
      // Log the full response for debugging
      console.log(`Full transcription response: ${JSON.stringify(transcriptionResponse)}`);
      
      // Use the detected text or empty string if not found
      if (transcriptionResponse.text) {
        const originalText = transcriptionResponse.text;
        console.log(`Transcription successful: { text: '${originalText}' }`);
        console.log(`📢 DIAGNOSTIC - EXACT TRANSCRIPTION FROM OPENAI: "${originalText}"`);
        
        // Check for potential prompt leakage
        const isPotentialPromptLeak = SUSPICIOUS_PHRASES.some(phrase => 
          originalText.includes(phrase)
        );
        
        if (isPotentialPromptLeak) {
          console.log('⚠️ DETECTED PROMPT LEAKAGE: The transcription appears to contain prompt instructions');
          console.log('Treating this as an empty transcription and triggering fallback mechanism');
          return '';
        }
        
        return originalText;
      } else {
        console.log('Transcription returned no text - Whisper API failed to detect speech');
        return '';
      }
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
   * Handle translation errors in a standardized way
   * Extracts useful information from various error types
   */
  private handleTranslationError(error: unknown, originalText: string, retryCount: number): TranslationErrorResponse {
    let errorMessage = 'Unknown error occurred';
    let statusCode: number | undefined = undefined;
    let shouldRetry = retryCount < this.maxRetries;
    
    // Process different types of errors
    if (error instanceof Error) {
      errorMessage = error.message;
      
      // Check for specific OpenAI API error patterns
      if ('status' in error && typeof (error as any).status === 'number') {
        statusCode = (error as any).status;
        
        // Only retry on specific error codes (429 rate limit, 500 server error, etc.)
        const code = statusCode || 0; // Use 0 if undefined
        shouldRetry = retryCount < this.maxRetries && 
          (code === 429 || code >= 500 || code === 0);
      }
    }
    
    console.error(`Translation error [attempt ${retryCount + 1}/${this.maxRetries + 1}]:`, errorMessage);
    
    return {
      error: errorMessage,
      originalText,
      retryCount,
      statusCode,
      shouldRetry
    };
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
      const prompt = `
        Translate this text from ${sourceLangName} to ${targetLangName}. 
        Maintain the same tone and style. Return only the translation without explanations or notes.
        
        Original text: "${text}"
        
        Translation:
      `;
      
      const translation = await this.openai.chat.completions.create({
        model: DEFAULT_CHAT_MODEL,
        messages: [
          { role: 'system', content: 'You are a professional translator with expertise in multiple languages.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.1,
        max_tokens: 500
      });
      
      const translatedText = translation.choices[0].message.content?.trim() || text;
      return translatedText;
    } catch (error) {
      const errorResponse = this.handleTranslationError(error, text, retryCount);
      
      // Implement exponential backoff retry
      if (errorResponse.shouldRetry) {
        const delay = Math.pow(2, retryCount) * 1000; // Exponential backoff
        console.log(`Retrying translation in ${delay}ms...`);
        
        await new Promise(resolve => setTimeout(resolve, delay));
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
   * Transcribe and translate speech
   * Main public method that orchestrates the workflow
   * Now includes emotional tone preservation in synthesized speech
   */
  async translateSpeech(
    audioBuffer: Buffer,
    sourceLanguage: string,
    targetLanguage: string,
    preTranscribedText?: string
  ): Promise<TranslationResult> {
    console.log(`Processing speech translation from ${sourceLanguage} to ${targetLanguage}`);
    
    // DEVELOPMENT MODE: Check if API key is missing
    if (!this.apiKeyAvailable) {
      return this.createDevelopmentModeTranslation(sourceLanguage, targetLanguage, preTranscribedText);
    }
    
    // Get original text (either from transcription or pre-provided)
    const originalText = await this.getOriginalText(
      audioBuffer,
      sourceLanguage,
      preTranscribedText
    );
    
    // Skip empty transcriptions
    if (!originalText) {
      return { 
        originalText: '', 
        translatedText: '', 
        audioBuffer 
      };
    }
    
    // Translate the text
    const translatedText = await this.translateText(
      originalText,
      sourceLanguage,
      targetLanguage
    );
    
    // Generate speech audio with emotional tone preservation
    let translatedAudioBuffer = audioBuffer; // Default to original audio
    
    try {
      // Use TTS service type from options if provided, or fall back to environment or default 'browser'
      const ttsServiceType = options.ttsServiceType || process.env.TTS_SERVICE_TYPE || 'browser';
      
      // Log the TTS service being used
      console.log(`Using TTS service '${ttsServiceType}' for language '${targetLanguage}'`);
      
      // Get the appropriate TTS service from the factory
      const ttsService = ttsFactory.getService(ttsServiceType);
      
      // Use the selected TTS service to generate audio with emotion preservation
      translatedAudioBuffer = await ttsService.synthesizeSpeech({
        text: translatedText || originalText,
        languageCode: targetLanguage,
        preserveEmotions: true // Enable emotional tone preservation
      });
      
      console.log(`Generated translated audio using ${ttsServiceType} service: ${translatedAudioBuffer.length} bytes`);
    } catch (error) {
      console.error('Error generating audio for translation:', error);
      // On error, keep the original audio buffer
    }
    
    return { 
      originalText, 
      translatedText: translatedText || originalText, // Fallback to original text if translation failed
      audioBuffer: translatedAudioBuffer
    };
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

// Export the legacy function for backward compatibility
export async function translateSpeech(
  audioBuffer: Buffer, 
  sourceLanguage: string, 
  targetLanguage: string,
  preTranscribedText?: string,
  ttsServiceType?: string
): Promise<TranslationResult> {
  return speechTranslationService.translateSpeech(
    audioBuffer,
    sourceLanguage,
    targetLanguage,
    preTranscribedText,
    {
      ttsServiceType: ttsServiceType // Pass through the TTS service type
    }
  );
}