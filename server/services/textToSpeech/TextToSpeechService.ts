/**
 * Text to Speech Service
 * 
 * This service is responsible for generating speech from translated text
 * with preserved emotional tone using OpenAI's Text-to-Speech API.
 */

import OpenAI, { OpenAIError } from 'openai';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import { createHash } from 'crypto';

// Promisify file system operations
const writeFile = promisify(fs.writeFile);
const mkdir = promisify(fs.mkdir);
const readFile = promisify(fs.readFile);
const stat = promisify(fs.stat);
const access = promisify(fs.access);

// Constants for cache directory
const CACHE_DIR = path.join(process.cwd(), 'audio-cache');
const MAX_CACHE_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours
const TEMP_DIR = process.env.TEMP_DIR || path.join(process.cwd(), 'temp');

// OpenAI TTS Constants
const DEFAULT_TTS_MODEL = 'tts-1';
const TTS_RESPONSE_FORMAT = 'mp3';
const DEFAULT_SPEED = 1.0;

// Emotion-specific speed adjustments
const EMOTION_SPEEDS = {
  excited: 1.2,
  serious: 0.9,
  calm: 0.9,
  sad: 0.8
} as const;

// Emotion-specific voice mappings
const EMOTION_VOICE_MAP = {
  excited: 'nova',
  serious: 'onyx',
  calm: 'shimmer',
  sad: 'echo'
} as const;

// Confidence calculation constants
const BASE_CONFIDENCE = 0.3;
const PATTERN_CONFIDENCE_WEIGHT = 0.5;
const MATCH_DENSITY_MULTIPLIER = 20;
const MIN_CONFIDENCE_FOR_FORMATTING = 0.5;

// Voice options by language and gender
const VOICE_OPTIONS: Record<string, string[]> = {
  'en': ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'], // English
  'es': ['nova', 'echo', 'alloy'], // Spanish (using neutral voices)
  'fr': ['alloy', 'nova', 'shimmer'], // French (using neutral voices)
  'de': ['onyx', 'nova', 'shimmer'], // German (using neutral voices)
  'ja': ['nova', 'alloy', 'echo'], // Japanese (using neutral voices)
  'zh': ['alloy', 'nova', 'onyx'], // Chinese (using neutral voices)
  'default': ['nova', 'alloy'] // Default fallback
};

// Emotion patterns to detect
interface EmotionPattern {
  name: string;
  voiceStyle: string;
  patterns: RegExp[];
}

// Emotion detection patterns
const EMOTION_PATTERNS: EmotionPattern[] = [
  {
    name: 'excited',
    voiceStyle: 'excited', // Higher pitch, faster pace
    patterns: [
      /\!+/g, // Exclamation marks
      /amazing|fantastic|incredible|awesome|wow|wonderful/gi,
      /😄|😃|😁|🤩|😍|🎉|💯|⚡/g // Excited emojis
    ]
  },
  {
    name: 'serious',
    voiceStyle: 'serious', // Slower, more deliberate pace
    patterns: [
      /important|critical|crucial|serious|warning|caution|beware/gi,
      /⚠️|❗|🚨|🔴|❓/g // Warning/serious emojis
    ]
  },
  {
    name: 'calm',
    voiceStyle: 'calming', // Soft, soothing tone
    patterns: [
      /relax|calm|gentle|peaceful|quiet|softly/gi,
      /😌|🧘|💭|☮️|💫/g // Calm emojis
    ]
  },
  {
    name: 'sad',
    voiceStyle: 'sad', // Lower pitch, slower pace
    patterns: [
      /sad|sorry|unfortunately|regret|disappointed/gi,
      /😢|😥|😔|😞|💔/g // Sad emojis
    ]
  }
];

/**
 * Interface for emotion detection result
 */
interface DetectedEmotion {
  emotion: string;
  confidence: number;
}

/**
 * Options for text-to-speech synthesis
 */
export interface TextToSpeechOptions {
  text: string;
  languageCode: string;
  voice?: string;
  speed?: number;
  preserveEmotions?: boolean;
}

/**
 * Interface for text-to-speech service
 */
export interface ITextToSpeechService {
  synthesizeSpeech(options: TextToSpeechOptions): Promise<Buffer>;
}

/**
 * Browser Speech Synthesis Service
 * This service doesn't actually generate audio data on the server.
 * It returns an empty buffer and signals the client to use browser's SpeechSynthesis API.
 */
export class BrowserSpeechSynthesisService implements ITextToSpeechService {
  /**
   * Instead of generating audio on the server, returns a special marker buffer
   * The client will recognize this marker and use the browser's SpeechSynthesis API
   */
  public async synthesizeSpeech(options: TextToSpeechOptions): Promise<Buffer> {
    console.log(`Using browser speech synthesis for text (${options.text.length} chars) in ${options.languageCode}`);
    
    // Create a special marker buffer that the client will recognize
    // We're using a text encoding with a specific header to signal browser speech synthesis
    const markerText = JSON.stringify({
      type: 'browser-speech',
      text: options.text,
      languageCode: options.languageCode,
      preserveEmotions: options.preserveEmotions,
      speed: options.speed || 1.0,
      autoPlay: true // Enable automatic playback to match OpenAI behavior
    });
    
    // Return the marker as a buffer
    return Buffer.from(markerText);
  }
}

/**
 * Silent Text to Speech Service
 * This is a fallback service that just returns an empty audio buffer
 * Useful for debugging or when no audio output is desired
 */
export class SilentTextToSpeechService implements ITextToSpeechService {
  public async synthesizeSpeech(_options: TextToSpeechOptions): Promise<Buffer> {
    console.log('Using silent (no audio) TTS service');
    
    // Return an empty buffer - no audio will be played
    return Buffer.from([]);
  }
}

/**
 * OpenAI Text to Speech Service
 * Handles text-to-speech conversion using OpenAI's TTS API
 */
export class OpenAITextToSpeechService implements ITextToSpeechService {
  private readonly openai: OpenAI;
  
  constructor(openai: OpenAI) {
    this.openai = openai;
    this.ensureCacheDirectoryExists();
  }
  
  /**
   * Ensure cache directory exists
   */
  private async ensureCacheDirectoryExists(): Promise<void> {
    try {
      await access(CACHE_DIR, fs.constants.F_OK);
    } catch (error) {
      // Directory doesn't exist, create it
      try {
        await mkdir(CACHE_DIR, { recursive: true });
        console.log(`Created audio cache directory: ${CACHE_DIR}`);
      } catch (mkdirError) {
        console.error('Error creating audio cache directory:', mkdirError);
      }
    }
    
    try {
      await access(TEMP_DIR, fs.constants.F_OK);
    } catch (error) {
      // Directory doesn't exist, create it
      try {
        await mkdir(TEMP_DIR, { recursive: true });
        console.log(`Created temp directory: ${TEMP_DIR}`);
      } catch (mkdirError) {
        console.error('Error creating temp directory:', mkdirError);
      }
    }
  }
  
  /**
   * Generate cache key for a TTS request
   */
  private generateCacheKey(options: TextToSpeechOptions): string {
    const dataToHash = JSON.stringify({
      text: options.text,
      languageCode: options.languageCode,
      voice: options.voice,
      speed: options.speed,
      preserveEmotions: options.preserveEmotions
    });
    
    return createHash('md5').update(dataToHash).digest('hex');
  }
  
  /**
   * Check if cached audio exists and is valid
   */
  private async getCachedAudio(cacheKey: string): Promise<Buffer | null> {
    const cachePath = path.join(CACHE_DIR, `${cacheKey}.mp3`);
    
    try {
      // Check if file exists
      await access(cachePath, fs.constants.F_OK);
      
      // Check file age
      const fileStats = await stat(cachePath);
      const fileAgeMs = Date.now() - fileStats.mtimeMs;
      
      if (fileAgeMs < MAX_CACHE_AGE_MS) {
        console.log(`Using cached audio: ${cachePath}`);
        return await readFile(cachePath);
      } else {
        console.log(`Cache expired for: ${cachePath}`);
        return null;
      }
    } catch (error) {
      // File doesn't exist or can't be accessed
      return null;
    }
  }
  
  /**
   * Save audio to cache
   */
  private async cacheAudio(cacheKey: string, audioBuffer: Buffer): Promise<void> {
    const cachePath = path.join(CACHE_DIR, `${cacheKey}.mp3`);
    
    try {
      await writeFile(cachePath, audioBuffer);
      console.log(`Cached audio to: ${cachePath}`);
    } catch (error) {
      console.error('Error caching audio:', error);
    }
  }
  
  /**
   * Detect emotions in text
   */
  private detectEmotions(text: string): DetectedEmotion[] {
    const detectedEmotions: DetectedEmotion[] = [];
    
    // Check for each emotion pattern
    EMOTION_PATTERNS.forEach(emotionPattern => {
      let matchCount = 0;
      let totalMatches = 0;
      
      // Check each pattern for this emotion
      emotionPattern.patterns.forEach(pattern => {
        const matches = text.match(pattern);
        if (matches && matches.length > 0) {
          matchCount++;
          totalMatches += matches.length;
        }
      });
      
      // Calculate confidence - based on how many different patterns matched
      if (matchCount > 0) {
        const patternRatio = matchCount / emotionPattern.patterns.length;
        const textLength = text.length;
        // Normalized confidence (0-1) with some smoothing based on text length
        const confidence = Math.min(
          BASE_CONFIDENCE + (patternRatio * PATTERN_CONFIDENCE_WEIGHT) + (totalMatches / textLength) * MATCH_DENSITY_MULTIPLIER, 
          1
        );
        
        detectedEmotions.push({
          emotion: emotionPattern.name,
          confidence
        });
      }
    });
    
    // Sort by confidence (descending)
    return detectedEmotions.sort((a, b) => b.confidence - a.confidence);
  }
  
  /**
   * Select appropriate voice for language and emotion
   */
  private selectVoice(languageCode: string, detectedEmotion?: string): string {
    const lang = languageCode.split('-')[0].toLowerCase(); // Normalize to base language code e.g., 'en'

    if (detectedEmotion && detectedEmotion in EMOTION_VOICE_MAP) {
      return EMOTION_VOICE_MAP[detectedEmotion as keyof typeof EMOTION_VOICE_MAP];
    }
    
    // Get available voices for this language
    const availableVoices = VOICE_OPTIONS[lang] || VOICE_OPTIONS.default;
    
    // Default to first available voice
    return availableVoices[0];
  }
  
  /**
   * Adjust speech parameters based on detected emotion
   */
  private adjustSpeechParams(emotion: string, options: TextToSpeechOptions): {
    voice: string;
    speed: number;
    input: string;
  } {
    const params: { voice: string, speed: number, input: string } = {
      voice: options.voice || this.selectVoice(options.languageCode, undefined), // Default voice if no emotion or specific mapping
      speed: options.speed || DEFAULT_SPEED,
      input: options.text,
    };

    const languageCode = options.languageCode || 'en'; // Default to 'en' if not provided

    // Apply emotion-specific adjustments if emotion is recognized
    if (emotion in EMOTION_SPEEDS) {
      params.voice = this.selectVoice(languageCode, emotion);
      params.speed = EMOTION_SPEEDS[emotion as keyof typeof EMOTION_SPEEDS];
      params.input = this.formatInputForEmotion(options.text, emotion);
    }

    return params;
  }
  
  /**
   * Format input text with SSML (Speech Synthesis Markup Language)
   * Note: OpenAI TTS doesn't support SSML directly but we can use text formatting
   * to better convey mood to the model
   */
  private formatInputForEmotion(text: string, emotion: string): string {
    let formattedText = text;
    if (emotion === 'excited') {
      formattedText = text.replace(/!/g, '!!').replace(/\?/g, '?!');
    } else if (emotion === 'serious') {
      formattedText = text.charAt(0).toUpperCase() + text.slice(1) + '...';
    } else if (emotion === 'calm') {
      if (!text.endsWith('.') && !text.endsWith('?') && !text.endsWith('!')) {
        formattedText = text + '.';
      }
    } else if (emotion === 'sad') {
      formattedText = text + '...';
    }
    return formattedText;
  }
  
  /**
   * Process emotions and adjust speech parameters if emotion preservation is enabled
   */
  private processEmotions(options: TextToSpeechOptions): {
    voice: string;
    speed: number;
    input: string;
  } {
    let voice = options.voice || this.selectVoice(options.languageCode);
    let speed = options.speed || DEFAULT_SPEED;
    let input = options.text;
    
    if (options.preserveEmotions) {
      const detectedEmotions = this.detectEmotions(options.text);
      
      if (detectedEmotions.length > 0) {
        const topEmotion = detectedEmotions[0];
        console.log(`Detected emotion: ${topEmotion.emotion} (confidence: ${topEmotion.confidence.toFixed(2)})`);
        
        const adjustedParams = this.adjustSpeechParams(topEmotion.emotion, options);
        voice = adjustedParams.voice;
        speed = adjustedParams.speed;
        
        if (topEmotion.confidence > MIN_CONFIDENCE_FOR_FORMATTING) {
          input = this.formatInputForEmotion(adjustedParams.input, topEmotion.emotion);
        } else {
          input = adjustedParams.input;
        }
      }
    }
    
    return { voice, speed, input };
  }
  
  /**
   * Call OpenAI's TTS API with the given parameters
   */
  private async callOpenAIAPI(voice: string, speed: number, input: string): Promise<Buffer> {
    try {
      const apiPayload = {
        model: DEFAULT_TTS_MODEL,
        input: input,
        voice: voice as any,
        response_format: TTS_RESPONSE_FORMAT as "mp3",
        speed: speed,
      };
      
      const response = await this.openai.audio.speech.create(apiPayload);
      return Buffer.from(await response.arrayBuffer());
    } catch (error) {
      throw new TextToSpeechError(
        `Speech synthesis failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'API_ERROR',
        error
      );
    }
  }
  
  /**
   * Synthesize speech from text using OpenAI's TTS API
   */
  public async synthesizeSpeech(options: TextToSpeechOptions): Promise<Buffer> {
    const cacheKey = this.generateCacheKey(options);
    
    // Check cache first
    const cachedAudio = await this.getCachedAudio(cacheKey);
    if (cachedAudio) {
      return cachedAudio;
    }
    
    try {
      console.log(`Synthesizing speech for text (${options.text.length} chars) in ${options.languageCode}`);
      
      // Process emotions and get adjusted parameters
      const { voice, speed, input } = this.processEmotions(options);
      
      // Create speech using OpenAI's API
      console.log(`Using voice: ${voice}, speed: ${speed}`);
      
      const audioBuffer = await this.callOpenAIAPI(voice, speed, input);
      
      // Cache the result for future use
      await this.cacheAudio(cacheKey, audioBuffer);
      
      return audioBuffer;
    } catch (error) {
      console.error('Error synthesizing speech:', error);
      
      // Re-throw TextToSpeechError as is, wrap other errors
      if (error instanceof TextToSpeechError) {
        throw error;
      }
      
      throw new Error(`Speech synthesis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

/**
 * Text to Speech Factory class
 * Creates and provides different text-to-speech service implementations
 */
export class TextToSpeechFactory {
  private static instance: TextToSpeechFactory;
  private openai: OpenAI;
  private services: Map<string, ITextToSpeechService> = new Map();
  
  private constructor() {
    // Initialize OpenAI client with API key from environment
    const apiKey = process.env.OPENAI_API_KEY || ''; // Ensure apiKey is a string
    
    try {
      this.openai = new OpenAI({ 
        apiKey: apiKey || 'sk-placeholder-for-factory-init' // Use a specific placeholder
      });
      // Log only if a real API key is configured, otherwise it's expected to use placeholder
      if (apiKey) {
        console.log('OpenAI client initialized for TextToSpeechFactory with API key.');
      } else {
        console.warn('OpenAI client for TextToSpeechFactory initialized with placeholder API key. OpenAI TTS will fail if used.');
      }
    } catch (error) {
      console.error('Critical error initializing OpenAI client for TextToSpeechFactory:', error);
      // Fallback to a placeholder client to prevent constructor failure
      this.openai = new OpenAI({ apiKey: 'sk-placeholder-on-error' });
    }
    
    // Register services
    this.services.set('openai', new OpenAITextToSpeechService(this.openai));
    this.services.set('browser', new BrowserSpeechSynthesisService());
    this.services.set('silent', new SilentTextToSpeechService());
  }
  
  public static getInstance(): TextToSpeechFactory {
    if (!TextToSpeechFactory.instance) {
      TextToSpeechFactory.instance = new TextToSpeechFactory();
    }
    return TextToSpeechFactory.instance;
  }
  
  public getService(serviceType: string = 'openai'): ITextToSpeechService {
    const service = this.services.get(serviceType.toLowerCase());
    if (!service) {
      console.warn(`TTS service '${serviceType}' not found, falling back to openai`);
      return this.services.get('openai')!;
    }
    return service;
  }
}

// Export factory instance for getting TTS services
export const ttsFactory = TextToSpeechFactory.getInstance();

// Export a convenience function to get the default TTS service (backward compatibility)
export const textToSpeechService = {
  synthesizeSpeech: async (options: TextToSpeechOptions): Promise<Buffer> => {
    // Get TTS service type from environment or default to 'openai'
    const serviceType = process.env.TTS_SERVICE_TYPE || 'openai';
    return ttsFactory.getService(serviceType).synthesizeSpeech(options);
  }
};

/**
 * Custom error class for Text-to-Speech specific errors
 */
export class TextToSpeechError extends Error {
  constructor(
    message: string,
    public readonly code: 'CACHE_ERROR' | 'API_ERROR' | 'INVALID_INPUT' | 'UNKNOWN_ERROR',
    public readonly originalError?: unknown
  ) {
    super(message);
    this.name = 'TextToSpeechError';
  }
}