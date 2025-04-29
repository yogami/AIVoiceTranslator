/**
 * Text to Speech Service - Modular Implementation
 * 
 * This service is responsible for generating speech from translated text
 * with preserved emotional tone using OpenAI's Text-to-Speech API.
 * 
 * Refactored to improve code quality with:
 * - Lower cyclomatic complexity (target: ≤ 3)
 * - Smaller functions (target: < 20 lines)
 * - Smaller classes (target: < 100 lines) 
 * - Reduced nesting depth (target: ≤ 3)
 * - SOLID principles (Single Responsibility, Open/Closed, Liskov Substitution,
 *   Interface Segregation, Dependency Inversion)
 */

import OpenAI from 'openai';
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
 * Interface for speech parameters used in TTS processing
 */
interface SpeechParams {
  voice: string;
  speed: number;
  input: string;
}

/**
 * Interface for file system operations
 */
export interface IFileSystem {
  readFile(path: string): Promise<Buffer>;
  writeFile(path: string, data: Buffer): Promise<void>;
  checkFileExists(path: string): Promise<boolean>;
  getFileStats(path: string): Promise<fs.Stats>;
  ensureDirectoryExists(dirPath: string): Promise<void>;
}

/**
 * Interface for cache operations
 */
export interface ICacheManager {
  generateCacheKey(options: TextToSpeechOptions): string;
  getCachedAudio(cacheKey: string): Promise<Buffer | null>;
  cacheAudio(cacheKey: string, audioBuffer: Buffer): Promise<void>;
  ensureCacheDirectories(): Promise<void>;
  saveToTemporaryFile(buffer: Buffer): Promise<string>;
}

/**
 * Interface for voice selection
 */
export interface IVoiceSelector {
  selectVoice(languageCode: string, emotion?: string): string;
}

/**
 * Interface for emotion processing
 */
export interface IEmotionProcessor {
  detectEmotions(text: string): DetectedEmotion[];
  formatInputForEmotion(text: string, emotion: string): string;
  adjustSpeechParams(emotion: string, options: TextToSpeechOptions): SpeechParams;
}

/**
 * Node file system implementation
 */
export class NodeFileSystem implements IFileSystem {
  public async readFile(filePath: string): Promise<Buffer> {
    return await readFile(filePath);
  }

  public async writeFile(filePath: string, data: Buffer): Promise<void> {
    await writeFile(filePath, data);
  }

  public async checkFileExists(filePath: string): Promise<boolean> {
    try {
      await access(filePath, fs.constants.F_OK);
      return true;
    } catch {
      return false;
    }
  }

  public async getFileStats(filePath: string): Promise<fs.Stats> {
    return await stat(filePath);
  }

  public async ensureDirectoryExists(dirPath: string): Promise<void> {
    try {
      await access(dirPath, fs.constants.F_OK);
    } catch (error) {
      try {
        await mkdir(dirPath, { recursive: true });
        console.log(`Created directory: ${dirPath}`);
      } catch (mkdirError) {
        console.error(`Error creating directory:`, mkdirError);
      }
    }
  }
}

/**
 * Implementation of cache manager
 */
export class TTSCacheManager implements ICacheManager {
  private readonly fileSystem: IFileSystem;
  private readonly cacheDir: string;
  private readonly tempDir: string;
  private readonly maxCacheAgeMs: number;

  constructor(fileSystem: IFileSystem, cacheDir: string = CACHE_DIR, tempDir: string = TEMP_DIR, maxCacheAgeMs: number = MAX_CACHE_AGE_MS) {
    this.fileSystem = fileSystem;
    this.cacheDir = cacheDir;
    this.tempDir = tempDir;
    this.maxCacheAgeMs = maxCacheAgeMs;
  }

  public generateCacheKey(options: TextToSpeechOptions): string {
    const dataToHash = JSON.stringify({
      text: options.text,
      languageCode: options.languageCode,
      voice: options.voice,
      speed: options.speed,
      preserveEmotions: options.preserveEmotions
    });
    
    return createHash('md5').update(dataToHash).digest('hex');
  }
  
  public async getCachedAudio(cacheKey: string): Promise<Buffer | null> {
    const cachePath = path.join(this.cacheDir, `${cacheKey}.mp3`);
    
    if (!await this.fileSystem.checkFileExists(cachePath)) {
      return null;
    }
    
    // Check file age
    const fileStats = await this.fileSystem.getFileStats(cachePath);
    const fileAgeMs = Date.now() - fileStats.mtimeMs;
    
    if (fileAgeMs < this.maxCacheAgeMs) {
      console.log(`Using cached audio: ${cachePath}`);
      return await this.fileSystem.readFile(cachePath);
    } else {
      console.log(`Cache expired for: ${cachePath}`);
      return null;
    }
  }
  
  public async cacheAudio(cacheKey: string, audioBuffer: Buffer): Promise<void> {
    const cachePath = path.join(this.cacheDir, `${cacheKey}.mp3`);
    
    try {
      await this.fileSystem.writeFile(cachePath, audioBuffer);
      console.log(`Cached audio to: ${cachePath}`);
    } catch (error) {
      console.error('Error caching audio:', error);
    }
  }
  
  public async ensureCacheDirectories(): Promise<void> {
    await this.fileSystem.ensureDirectoryExists(this.cacheDir);
    await this.fileSystem.ensureDirectoryExists(this.tempDir);
  }

  public async saveToTemporaryFile(buffer: Buffer): Promise<string> {
    const outputFilePath = path.join(this.tempDir, `tts-${Date.now()}.mp3`);
    await this.fileSystem.writeFile(outputFilePath, buffer);
    console.log(`Saved synthesized speech to: ${outputFilePath}`);
    return outputFilePath;
  }
}

/**
 * Implementation of emotion processor
 */
export class EmotionDetector implements IEmotionProcessor {
  private readonly emotionPatterns: EmotionPattern[];
  private readonly voiceSelector: IVoiceSelector;
  
  constructor(emotionPatterns: EmotionPattern[] = EMOTION_PATTERNS, voiceSelector: IVoiceSelector) {
    this.emotionPatterns = emotionPatterns;
    this.voiceSelector = voiceSelector;
  }

  /**
   * Detect emotions in text
   */
  public detectEmotions(text: string): DetectedEmotion[] {
    const detectedEmotions: DetectedEmotion[] = [];
    
    // Check for each emotion pattern
    this.emotionPatterns.forEach(emotionPattern => {
      const result = this.processEmotionPattern(text, emotionPattern);
      if (result) {
        detectedEmotions.push(result);
      }
    });
    
    // Sort by confidence (descending)
    return detectedEmotions.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Process a single emotion pattern against text
   */
  private processEmotionPattern(text: string, emotionPattern: EmotionPattern): DetectedEmotion | null {
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
    
    // Calculate confidence if we have matches
    if (matchCount > 0) {
      const confidence = this.calculateConfidence(matchCount, totalMatches, text.length, emotionPattern.patterns.length);
      return {
        emotion: emotionPattern.name,
        confidence
      };
    }
    
    return null;
  }

  /**
   * Calculate confidence score for emotion detection
   */
  private calculateConfidence(matchCount: number, totalMatches: number, textLength: number, patternCount: number): number {
    // Pattern match ratio (how many different patterns matched)
    const patternRatio = matchCount / patternCount;
    
    // Normalized confidence with smoothing based on text length
    return Math.min(0.3 + (patternRatio * 0.5) + (totalMatches / textLength) * 20, 1);
  }
  
  /**
   * Format input text with SSML (Speech Synthesis Markup Language)
   * Note: OpenAI TTS doesn't support SSML directly but we can use text formatting
   * to better convey mood to the model
   */
  public formatInputForEmotion(text: string, emotion: string): string {
    // Basic formatting based on emotion
    switch (emotion) {
      case 'excited':
        return text.replace(/\!/g, '!!').replace(/\./g, '! ');
      case 'serious':
        return text.replace(/(\w+)/g, (match) => {
          if (match.length > 4 && Math.random() > 0.7) {
            return match.toUpperCase();
          }
          return match;
        });
      case 'calm':
        return text.replace(/\./g, '... ').replace(/\!/g, '.');
      case 'sad':
        return text.replace(/\./g, '... ').replace(/\!/g, '...');
      default:
        return text;
    }
  }
  
  /**
   * Adjust speed based on emotion
   */
  private adjustSpeedForEmotion(emotion: string, baseSpeed: number): number {
    switch (emotion) {
      case 'excited':
        return Math.min(baseSpeed * 1.2, 1.75); // Faster for excitement
      case 'serious':
        return Math.max(baseSpeed * 0.9, 0.7); // Slower for seriousness
      case 'calm':
        return Math.max(baseSpeed * 0.85, 0.7); // Slower for calmness
      case 'sad':
        return Math.max(baseSpeed * 0.8, 0.7); // Slower for sadness
      default:
        return baseSpeed;
    }
  }
  
  /**
   * Apply special formatting to input text based on emotion
   */
  private applyEmotionalEmphasis(text: string, emotion: string): string {
    switch (emotion) {
      case 'excited':
        // Emphasize exclamations and enthusiastic words
        return text.replace(
          /(!+|\bwow\b|\bamazing\b|\bincredible\b|\bawesome\b)/gi,
          match => match.toUpperCase()
        );
      case 'serious':
        // Add more spacing between important words
        return text.replace(
          /(\bimportant\b|\bcritical\b|\bcrucial\b|\bserious\b|\bwarning\b)/gi,
          match => `. ${match.toUpperCase()} .`
        );
      default:
        return text;
    }
  }
  
  /**
   * Adjust speech parameters based on detected emotion
   */
  public adjustSpeechParams(emotion: string, options: TextToSpeechOptions): SpeechParams {
    // Get voice based on emotion and language
    const voice = options.voice || this.voiceSelector.selectVoice(options.languageCode, emotion);
    
    // Set base speed (default to 1.0 if not specified)
    const baseSpeed = options.speed || 1.0;
    
    // Adjust speed based on emotion
    const speed = this.adjustSpeedForEmotion(emotion, baseSpeed);
    
    // Apply emotional emphasis to text
    const input = this.applyEmotionalEmphasis(options.text, emotion);
    
    return { voice, speed, input };
  }
}

/**
 * Voice selection implementation
 */
export class VoiceSelector implements IVoiceSelector {
  private readonly voiceOptions: Record<string, string[]>;
  
  constructor(voiceOptions: Record<string, string[]> = VOICE_OPTIONS) {
    this.voiceOptions = voiceOptions;
  }
  
  /**
   * Get available voices for a language
   */
  private getAvailableVoices(languageCode: string): string[] {
    // Extract base language code (e.g., 'en' from 'en-US')
    const baseLanguage = languageCode.split('-')[0].toLowerCase();
    
    // Return available voices for this language or use the default
    return this.voiceOptions[baseLanguage] || this.voiceOptions.default;
  }
  
  /**
   * Check if a specific voice is available for a language
   */
  private isVoiceAvailable(voice: string, availableVoices: string[]): boolean {
    return availableVoices.includes(voice);
  }
  
  /**
   * Get preferred voice for an emotion
   */
  private getPreferredVoiceForEmotion(emotion: string): string {
    switch (emotion) {
      case 'excited':
        return 'echo';
      case 'serious':
        return 'onyx';
      case 'calm':
        return 'nova';
      case 'sad':
        return 'shimmer';
      default:
        return 'nova'; // Default voice
    }
  }
  
  /**
   * Select appropriate voice for language and emotion
   */
  public selectVoice(languageCode: string, emotion?: string): string {
    const availableVoices = this.getAvailableVoices(languageCode);
    
    // If emotion is specified, try to use the preferred voice for that emotion
    if (emotion) {
      const preferredVoice = this.getPreferredVoiceForEmotion(emotion);
      
      // Check if preferred voice is available for this language
      if (this.isVoiceAvailable(preferredVoice, availableVoices)) {
        return preferredVoice;
      }
    }
    
    // Default to first available voice if no emotion or preferred voice isn't available
    return availableVoices[0];
  }
}

/**
 * Interface for TTS API provider
 */
export interface ITTSApiProvider {
  createSpeech(voice: string, speed: number, input: string): Promise<Buffer>;
}

/**
 * OpenAI API wrapper for text-to-speech
 */
export class OpenAITTSApiProvider implements ITTSApiProvider {
  private readonly openai: OpenAI;
  private readonly model: string;
  
  constructor(openai: OpenAI, model: string = "tts-1") {
    this.openai = openai;
    this.model = model;
  }
  
  /**
   * Call OpenAI API to create speech audio
   */
  public async createSpeech(voice: string, speed: number, input: string): Promise<Buffer> {
    console.log(`Using voice: ${voice}, speed: ${speed}`);
    
    const mp3 = await this.openai.audio.speech.create({
      model: this.model, // Basic model, use tts-1-hd for higher quality
      voice: voice,
      input: input,
      speed: speed,
      response_format: "mp3",
    });
    
    return Buffer.from(await mp3.arrayBuffer());
  }
}

/**
 * Interface for error handling
 */
export interface IErrorHandler {
  handleSynthesisError(error: unknown): never;
}

/**
 * Implementation of TTS error handler
 */
export class TTSErrorHandler implements IErrorHandler {
  public handleSynthesisError(error: unknown): never {
    console.error('Error synthesizing speech:', error);
    throw new Error(`Speech synthesis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * OpenAI Text to Speech Service
 * Handles text-to-speech conversion using OpenAI's TTS API
 */
export class OpenAITextToSpeechService implements ITextToSpeechService {
  private readonly apiProvider: ITTSApiProvider;
  private readonly cacheManager: ICacheManager;
  private readonly emotionProcessor: IEmotionProcessor;
  private readonly errorHandler: IErrorHandler;
  
  constructor(
    apiProvider: ITTSApiProvider,
    cacheManager: ICacheManager,
    emotionProcessor: IEmotionProcessor,
    errorHandler: IErrorHandler
  ) {
    this.apiProvider = apiProvider;
    this.cacheManager = cacheManager;
    this.emotionProcessor = emotionProcessor;
    this.errorHandler = errorHandler;
  }
  
  /**
   * Main method to synthesize speech from text
   */
  public async synthesizeSpeech(options: TextToSpeechOptions): Promise<Buffer> {
    // Ensure cache directories exist
    await this.cacheManager.ensureCacheDirectories();
    
    // Generate cache key
    const cacheKey = this.cacheManager.generateCacheKey(options);
    
    // Check cache first
    const cachedAudio = await this.cacheManager.getCachedAudio(cacheKey);
    if (cachedAudio) {
      return cachedAudio;
    }
    
    try {
      console.log(`Synthesizing speech for text (${options.text.length} chars) in ${options.languageCode}`);
      
      // Process text for emotion if enabled
      const processedOptions = await this.processOptions(options);
      
      // Create speech using API provider
      const buffer = await this.apiProvider.createSpeech(
        processedOptions.voice, 
        processedOptions.speed, 
        processedOptions.input
      );
      
      // Save to temporary file for debugging (optional)
      await this.cacheManager.saveToTemporaryFile(buffer);
      
      // Cache the result for future use
      await this.cacheManager.cacheAudio(cacheKey, buffer);
      
      return buffer;
    } catch (error) {
      return this.errorHandler.handleSynthesisError(error);
    }
  }
  
  /**
   * Process options with emotion detection if enabled
   */
  private async processOptions(options: TextToSpeechOptions): Promise<SpeechParams> {
    let voice = options.voice;
    let speed = options.speed || 1.0;
    let input = options.text;
    
    // If emotion preservation is requested
    if (options.preserveEmotions) {
      // Detect emotions in the text
      const detectedEmotions = this.emotionProcessor.detectEmotions(options.text);
      
      if (detectedEmotions.length > 0) {
        // Use the highest confidence emotion
        const topEmotion = detectedEmotions[0];
        console.log(`Detected emotion: ${topEmotion.emotion} (confidence: ${topEmotion.confidence.toFixed(2)})`);
        
        // Adjust speech parameters
        const adjustedParams = this.emotionProcessor.adjustSpeechParams(topEmotion.emotion, options);
        voice = adjustedParams.voice;
        speed = adjustedParams.speed;
        
        // Format input for emotion if confidence is high enough
        if (topEmotion.confidence > 0.5) {
          input = this.emotionProcessor.formatInputForEmotion(adjustedParams.input, topEmotion.emotion);
        } else {
          input = adjustedParams.input;
        }
      }
    }
    
    return { voice, speed, input };
  }
} = this.getAvailableVoices(languageCode);
    
    // If no emotion is specified, use the first available voice
    if (!emotion) {
      return availableVoices[0];
    }
    
    // Get the preferred voice for this emotion
    const preferredVoice = this.getPreferredVoiceForEmotion(emotion);
    
    // Use the preferred voice if available, otherwise fallback to first available
    return this.isVoiceAvailable(preferredVoice, availableVoices) 
      ? preferredVoice 
      : availableVoices[0];
  }
}

/**
 * Interface for TTS API provider
 */
export interface ITTSApiProvider {
  createSpeech(voice: string, speed: number, input: string): Promise<Buffer>;
}

/**
 * OpenAI API wrapper for text-to-speech
 */
export class OpenAITTSApiProvider implements ITTSApiProvider {
  private readonly openai: OpenAI;
  private readonly model: string;
  
  constructor(openai: OpenAI, model: string = "tts-1") {
    this.openai = openai;
    this.model = model;
  }
  
  /**
   * Call OpenAI API to create speech audio
   */
  public async createSpeech(voice: string, speed: number, input: string): Promise<Buffer> {
    console.log(`Using voice: ${voice}, speed: ${speed}`);
    
    const mp3 = await this.openai.audio.speech.create({
      model: this.model, // Basic model, use tts-1-hd for higher quality
      voice: voice,
      input: input,
      speed: speed,
      response_format: "mp3",
    });
    
    return Buffer.from(await mp3.arrayBuffer());
  }
}

/**
 * Interface for error handling
 */
export interface IErrorHandler {
  handleSynthesisError(error: unknown): never;
}

/**
 * Implementation of TTS error handler
 */
export class TTSErrorHandler implements IErrorHandler {
  public handleSynthesisError(error: unknown): never {
    console.error('Error synthesizing speech:', error);
    throw new Error(`Speech synthesis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * OpenAI Text to Speech Service
 * Handles text-to-speech conversion using OpenAI's TTS API
 */
export class OpenAITextToSpeechService implements ITextToSpeechService {
  private readonly apiProvider: ITTSApiProvider;
  private readonly cacheManager: ICacheManager;
  private readonly emotionProcessor: IEmotionProcessor;
  private readonly errorHandler: IErrorHandler;
  
  constructor(
    apiProvider: ITTSApiProvider,
    cacheManager: ICacheManager,
    emotionProcessor: IEmotionProcessor,
    errorHandler: IErrorHandler
  ) {
    this.apiProvider = apiProvider;
    this.cacheManager = cacheManager;
    this.emotionProcessor = emotionProcessor;
    this.errorHandler = errorHandler;
  }

  /**
   * Process the emotion preservation in speech synthesis
   */
  private processEmotionPreservation(options: TextToSpeechOptions): SpeechParams {
    // Default parameters without emotion processing
    const defaultParams: SpeechParams = {
      voice: options.voice || 'nova',
      speed: options.speed || 1.0,
      input: options.text
    };
    
    // Skip emotion processing if not requested
    if (!options.preserveEmotions) {
      return defaultParams;
    }
    
    // Detect emotions in the text
    const detectedEmotions = this.emotionProcessor.detectEmotions(options.text);
    
    // If no emotions detected, return default parameters
    if (detectedEmotions.length === 0) {
      return defaultParams;
    }
    
    // Use the highest confidence emotion
    const topEmotion = detectedEmotions[0];
    console.log(`Detected emotion: ${topEmotion.emotion} (confidence: ${topEmotion.confidence.toFixed(2)}`);
    
    // Adjust speech parameters based on the detected emotion
    const adjustedParams = this.emotionProcessor.adjustSpeechParams(topEmotion.emotion, options);
    
    // Apply additional emotional formatting if confidence is high enough
    if (topEmotion.confidence > 0.5) {
      adjustedParams.input = this.emotionProcessor.formatInputForEmotion(adjustedParams.input, topEmotion.emotion);
    }
    
    return adjustedParams;
  }
  
  /**
   * Synthesize speech from text using OpenAI's TTS API
   */
  public async synthesizeSpeech(options: TextToSpeechOptions): Promise<Buffer> {
    await this.cacheManager.ensureCacheDirectories();
    
    // Generate cache key and check for cached audio
    const cacheKey = this.cacheManager.generateCacheKey(options);
    const cachedAudio = await this.cacheManager.getCachedAudio(cacheKey);
    if (cachedAudio) {
      return cachedAudio;
    }
    
    try {
      console.log(`Synthesizing speech for text (${options.text.length} chars) in ${options.languageCode}`);
      
      // Process speech parameters with emotion preservation if requested
      const speechParams = this.processEmotionPreservation(options);
      
      // Generate speech using the API provider
      const buffer = await this.apiProvider.createSpeech(
        speechParams.voice,
        speechParams.speed,
        speechParams.input
      );
      
      // Save to temporary file for debugging and cache for future use
      await this.cacheManager.saveToTemporaryFile(buffer);
      await this.cacheManager.cacheAudio(cacheKey, buffer);
      
      return buffer;
    } catch (error) {
      return this.errorHandler.handleSynthesisError(error);
    }
  }
}

/**
 * Text to Speech Factory - Updated to use SOLID principles and dependency injection
 */
export class TextToSpeechFactory {
  /**
   * Create an OpenAI TTS service with all required dependencies
   */
  public static createOpenAIService(openai: OpenAI): ITextToSpeechService {
    // Create file system implementation
    const fileSystem = new NodeFileSystem();
    
    // Create cache manager
    const cacheManager = new TTSCacheManager(fileSystem);
    
    // Create voice selector
    const voiceSelector = new VoiceSelector();
    
    // Create emotion processor
    const emotionProcessor = new EmotionDetector(EMOTION_PATTERNS, voiceSelector);
    
    // Create API provider
    const apiProvider = new OpenAITTSApiProvider(openai);
    
    // Create error handler
    const errorHandler = new TTSErrorHandler();
    
    // Create and return the service with all dependencies
    return new OpenAITextToSpeechService(
      apiProvider,
      cacheManager,
      emotionProcessor,
      errorHandler
    );
  }
  
  /**
   * Create a browser speech synthesis service
   */
  public static createBrowserSpeechService(): ITextToSpeechService {
    return new BrowserSpeechSynthesisService();
  }
  
  /**
   * Create a silent TTS service
   */
  public static createSilentService(): ITextToSpeechService {
    return new SilentTextToSpeechService();
  }
}

// Export a function to get a TTS service by type
export function getTextToSpeechService(serviceType: string = 'openai', openai?: OpenAI): ITextToSpeechService {
  switch (serviceType.toLowerCase()) {
    case 'browser':
      return TextToSpeechFactory.createBrowserSpeechService();
    case 'silent':
      return TextToSpeechFactory.createSilentService();
    case 'openai':
    default:
      if (!openai) {
        throw new Error('OpenAI client is required for OpenAI TTS service');
      }
      return TextToSpeechFactory.createOpenAIService(openai);
  }
}
