/**
 * Translation Service
 * 
 * Handles speech recognition, language translation, and text-to-speech conversion.
 * Uses OpenAI API for these operations with proper error handling.
 */

import fs from 'fs';
import { OpenAI } from 'openai';
import { OpenAITextToSpeechService, TextToSpeechFactory } from './TextToSpeechService';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';

// Interfaces
export interface TranslationResult {
  originalText: string;
  translatedText: string;
  audioBuffer: Buffer;
  languageCode: string;
  confidence?: number;
}

// Environment and constants
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const NODE_ENV = process.env.NODE_ENV || 'development';
const isTestEnvironment = NODE_ENV === 'test';
const isProductionEnvironment = NODE_ENV === 'production';

// Validate API key at startup
const hasApiKey = Boolean(OPENAI_API_KEY && OPENAI_API_KEY.length > 10);
const apiKeyStatus = hasApiKey ? 'Present' : 'Missing';
console.log(`OpenAI API key status: ${apiKeyStatus}`);

// Initialize the OpenAI client only if API key is available
let openai: OpenAI | null = null;
if (hasApiKey) {
  try {
    openai = new OpenAI({
      apiKey: OPENAI_API_KEY,
    });
    console.log('OpenAI client initialized successfully');
  } catch (error) {
    console.error('Failed to initialize OpenAI client:', error);
  }
}

/**
 * Create a development mode translation response
 * @param sourceLanguage Source language code (e.g., 'en')
 * @param targetLanguage Target language code (e.g., 'es')
 * @returns A mock translation result for development purposes
 */
function createDevelopmentModeTranslation(sourceLanguage: string, targetLanguage: string): TranslationResult {
  // Prepare a message based on the target language
  let translatedText = 'This is a development mode translation. OpenAI API key is missing or invalid.';
  
  // Add translations for common target languages
  if (targetLanguage === 'es') {
    translatedText = 'Esta es una traducción en modo de desarrollo. La clave API de OpenAI falta o es inválida.';
  } else if (targetLanguage === 'fr') {
    translatedText = 'Ceci est une traduction en mode développement. La clé API OpenAI est manquante ou invalide.';
  } else if (targetLanguage === 'de') {
    translatedText = 'Dies ist eine Übersetzung im Entwicklungsmodus. Der OpenAI-API-Schlüssel fehlt oder ist ungültig.';
  }
  
  // Create a simple audio buffer with silence (1 second of silence at 44.1kHz)
  const audioBuffer = Buffer.alloc(88200);
  
  return {
    originalText: 'Development mode active. No actual transcription performed.',
    translatedText,
    audioBuffer,
    languageCode: targetLanguage,
    confidence: 1.0, // Mock confidence score
  };
}

/**
 * Speech Translation Service
 * Main service interface that exposes all translation-related functionality
 */
export const speechTranslationService = {
  transcribeSpeech,
  translateText,
  textToSpeech,
  translateSpeech,
};

/**
 * Transcribe speech from audio buffer
 * @param audioBuffer Audio buffer containing speech
 * @param sourceLanguage Source language code (e.g., 'en')
 * @returns Transcribed text
 */
async function transcribeSpeech(audioBuffer: Buffer, sourceLanguage: string): Promise<string> {
  if (!openai) {
    logger.warn('OpenAI client not initialized. Using development mode.');
    return 'Development mode active. No actual transcription performed.';
  }
  
  try {
    // Save buffer to temporary file
    const tempFilePath = `/tmp/audio-${uuidv4()}.webm`;
    fs.writeFileSync(tempFilePath, audioBuffer);
    
    // Format the language code to ISO-639-1 format (e.g., 'en', 'es')
    // Extract the primary language code if it's in the format 'en-US' or similar
    const primaryLanguage = sourceLanguage.split('-')[0].toLowerCase();
    
    // Create readable stream
    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream(tempFilePath),
      model: 'whisper-1',
      language: primaryLanguage,
    });
    
    // Clean up temp file
    fs.unlinkSync(tempFilePath);
    
    return transcription.text;
  } catch (error) {
    logger.error('Error transcribing speech:', error);
    
    // In test environment, propagate the error for proper testing
    if (isTestEnvironment) {
      throw error;
    }
    
    // In production, return empty string for graceful fallback
    return '';
  }
}

/**
 * Translate text from source to target language
 * @param text Text to translate
 * @param sourceLanguage Source language code (e.g., 'en')
 * @param targetLanguage Target language code (e.g., 'es')
 * @returns Translated text
 */
async function translateText(text: string, sourceLanguage: string, targetLanguage: string): Promise<string> {
  if (!openai) {
    logger.warn('OpenAI client not initialized. Using development mode.');
    return `Development mode translation to ${targetLanguage}`;
  }
  
  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: `You are a translator. Translate the following text from ${sourceLanguage} to ${targetLanguage}. Preserve the emotional tone and nuance of the original text. Only respond with the translated text, no explanations.`,
        },
        { role: 'user', content: text },
      ],
      temperature: 0.3,
      max_tokens: 500,
    });
    
    return completion.choices[0].message.content || '';
  } catch (error) {
    logger.error('Error translating text:', error);
    
    // In test environment, propagate the error for proper testing
    if (isTestEnvironment) {
      throw error;
    }
    
    // In production, return empty string for graceful fallback
    return '';
  }
}

/**
 * Convert text to speech
 * @param text Text to convert to speech
 * @param languageCode Language code for speech synthesis
 * @returns Audio buffer
 */
async function textToSpeech(text: string, languageCode: string): Promise<Buffer> {
  try {
    // Use the TextToSpeechFactory to get a properly configured TTS service
    const ttsFactory = TextToSpeechFactory.getInstance();
    const ttsService = ttsFactory.getService('openai');
    return await ttsService.synthesizeSpeech({
      text: text,
      languageCode: languageCode,
      voice: 'nova', // Use nova as the default voice to avoid OpenAI API errors
      speed: 1.0,
      preserveEmotions: true
    });
  } catch (error) {
    logger.error('Error generating speech:', error);
    
    // In test environment, propagate the error for proper testing
    if (isTestEnvironment) {
      throw error;
    }
    
    // In production, return empty buffer for graceful fallback
    return Buffer.alloc(0);
  }
}

/**
 * Full process: transcribe, translate, and synthesize speech
 * @param audioBuffer Audio buffer containing speech
 * @param sourceLanguage Source language code (e.g., 'en')
 * @param targetLanguage Target language code (e.g., 'es')
 * @returns Translation result including original text, translated text, and audio buffer
 */
export async function translateSpeech(
  audioBuffer: Buffer,
  sourceLanguage: string,
  targetLanguage: string
): Promise<TranslationResult> {
  // Check if we're in development mode without API key
  if (!openai) {
    logger.warn('OpenAI API key missing. Using development mode translation.');
    return createDevelopmentModeTranslation(sourceLanguage, targetLanguage);
  }
  
  try {
    // Step 1: Transcribe speech to text
    const originalText = await transcribeSpeech(audioBuffer, sourceLanguage);
    
    // Step 2: Translate text to target language
    const translatedText = await translateText(originalText, sourceLanguage, targetLanguage);
    
    // Step 3: Convert translated text to speech
    const speechBuffer = await textToSpeech(translatedText, targetLanguage);
    
    // Return complete result
    return {
      originalText,
      translatedText,
      audioBuffer: speechBuffer,
      languageCode: targetLanguage,
    };
  } catch (error) {
    logger.error('Error in translation pipeline:', error);
    
    // In test environment, propagate the error for proper testing
    if (isTestEnvironment) {
      throw error;
    }
    
    // In production, return a graceful fallback
    return {
      originalText: '',
      translatedText: '',
      audioBuffer: Buffer.alloc(0),
      languageCode: targetLanguage,
      confidence: 0,
    };
  }
}
