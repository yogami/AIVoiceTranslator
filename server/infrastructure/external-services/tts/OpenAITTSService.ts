/**
 * OpenAI TTS Service Wrapper
 * Wraps the existing OpenAI TTS implementation to match the ITTSService interface
 */

import { ITTSService, TTSResult } from './TTSService';
import OpenAI from 'openai';
import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';
import { createHash } from 'crypto';


const writeFile = promisify(fs.writeFile);
const mkdir = promisify(fs.mkdir);
const readFile = promisify(fs.readFile);
const stat = promisify(fs.stat);
const access = promisify(fs.access);

const CACHE_DIR = path.join(process.cwd(), 'audio-cache');
const MAX_CACHE_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours
const TEMP_DIR = process.env.TEMP_DIR || path.join(process.cwd(), 'temp');
const DEFAULT_TTS_MODEL = 'tts-1';
const TTS_RESPONSE_FORMAT = 'mp3';
const DEFAULT_SPEED = 1.0;
const EMOTION_SPEEDS = { excited: 1.2, serious: 0.9, calm: 0.9, sad: 0.8 } as const;
const EMOTION_VOICE_MAP = { excited: 'nova', serious: 'onyx', calm: 'shimmer', sad: 'echo' } as const;
const VOICE_OPTIONS: Record<string, string[]> = {
  'en': ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'],
  'es': ['nova', 'echo', 'alloy'],
  'fr': ['alloy', 'nova', 'shimmer'],
  'de': ['onyx', 'nova', 'shimmer'],
  'ja': ['nova', 'alloy', 'echo'],
  'zh': ['alloy', 'nova', 'onyx'],
  'default': ['nova', 'alloy']
};
const BASE_CONFIDENCE = 0.3;
const PATTERN_CONFIDENCE_WEIGHT = 0.5;
const MATCH_DENSITY_MULTIPLIER = 20;
const MIN_CONFIDENCE_FOR_FORMATTING = 0.5;
const EMOTION_PATTERNS = [
  { name: 'excited', voiceStyle: 'excited', patterns: [/\!+/g, /amazing|fantastic|incredible|awesome|wow|wonderful/gi, /😄|😃|😁|🤩|😍|🎉|💯|⚡/g] },
  { name: 'serious', voiceStyle: 'serious', patterns: [/important|critical|crucial|serious|warning|caution|beware/gi, /⚠️|❗|🚨|🔴|❓/g] },
  { name: 'calm', voiceStyle: 'calming', patterns: [/relax|calm|gentle|peaceful|quiet|softly/gi, /😌|🧘|💭|☮️|💫/g] },
  { name: 'sad', voiceStyle: 'sad', patterns: [/sad|sorry|unfortunately|regret|disappointed/gi, /😢|😥|😔|😞|💔/g] }
];

export class OpenAITTSService implements ITTSService {
  private isInitialized = false;
  private openai: OpenAI;

  constructor() {
    this.isInitialized = true;
    this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || '' });
    this.ensureCacheDirectoryExists();
    console.log('[OpenAI TTS] Service initialized');
  }

  private async ensureCacheDirectoryExists(): Promise<void> {
    try { await access(CACHE_DIR, fs.constants.F_OK); } catch { try { await mkdir(CACHE_DIR, { recursive: true }); } catch {} }
    try { await access(TEMP_DIR, fs.constants.F_OK); } catch { try { await mkdir(TEMP_DIR, { recursive: true }); } catch {} }
  }

  private generateCacheKey(text: string, language: string, voice: string, speed: number, preserveEmotions: boolean): string {
    const dataToHash = JSON.stringify({ text, language, voice, speed, preserveEmotions });
    return createHash('md5').update(dataToHash).digest('hex');
  }

  private async getCachedAudio(cacheKey: string): Promise<Buffer | null> {
    const cachePath = path.join(CACHE_DIR, `${cacheKey}.mp3`);
    try {
      await access(cachePath, fs.constants.F_OK);
      const fileStats = await stat(cachePath);
      const fileAgeMs = Date.now() - fileStats.mtimeMs;
      if (fileAgeMs < MAX_CACHE_AGE_MS) {
        return await readFile(cachePath);
      }
    } catch {}
    return null;
  }

  private async cacheAudio(cacheKey: string, audioBuffer: Buffer): Promise<void> {
    const cachePath = path.join(CACHE_DIR, `${cacheKey}.mp3`);
    try { await writeFile(cachePath, audioBuffer); } catch {}
  }

  private detectEmotions(text: string): { emotion: string; confidence: number }[] {
    const detectedEmotions: { emotion: string; confidence: number }[] = [];
    EMOTION_PATTERNS.forEach(emotionPattern => {
      let matchCount = 0, totalMatches = 0;
      emotionPattern.patterns.forEach(pattern => {
        const matches = text.match(pattern);
        if (matches && matches.length > 0) { matchCount++; totalMatches += matches.length; }
      });
      if (matchCount > 0) {
        const patternRatio = matchCount / emotionPattern.patterns.length;
        const textLength = text.length;
        const confidence = Math.min(BASE_CONFIDENCE + (patternRatio * PATTERN_CONFIDENCE_WEIGHT) + (totalMatches / textLength) * MATCH_DENSITY_MULTIPLIER, 1);
        detectedEmotions.push({ emotion: emotionPattern.name, confidence });
      }
    });
    return detectedEmotions.sort((a, b) => b.confidence - a.confidence);
  }

  private selectVoice(language: string, detectedEmotion?: string, fallbackVoice: string = 'nova'): string {
    const lang = language.split('-')[0].toLowerCase();
    if (detectedEmotion && detectedEmotion in EMOTION_VOICE_MAP) return EMOTION_VOICE_MAP[detectedEmotion as keyof typeof EMOTION_VOICE_MAP];
    const availableVoices = VOICE_OPTIONS[lang] || VOICE_OPTIONS.default;
    return availableVoices[0] || fallbackVoice;
  }

  private adjustSpeechParams(emotion: string, text: string, language: string, voice: string, speed: number): { voice: string; speed: number; input: string } {
    let v = voice || this.selectVoice(language, undefined);
    let s = speed || DEFAULT_SPEED;
    let input = text;
    if (emotion in EMOTION_SPEEDS) {
      v = this.selectVoice(language, emotion);
      s = EMOTION_SPEEDS[emotion as keyof typeof EMOTION_SPEEDS];
      input = this.formatInputForEmotion(text, emotion);
    }
    return { voice: v, speed: s, input };
  }

  private formatInputForEmotion(text: string, emotion: string): string {
    let formattedText = text;
    if (emotion === 'excited') formattedText = text.replace(/!/g, '!!').replace(/\?/g, '?!');
    else if (emotion === 'serious') formattedText = text.charAt(0).toUpperCase() + text.slice(1) + '...';
    else if (emotion === 'calm') { if (!text.endsWith('.') && !text.endsWith('?') && !text.endsWith('!')) formattedText = text + '.'; }
    else if (emotion === 'sad') formattedText = text + '...';
    return formattedText;
  }

  private processEmotions(text: string, language: string, voice: string, speed: number, preserveEmotions: boolean): { voice: string; speed: number; input: string } {
    let v = voice || this.selectVoice(language);
    let s = speed || DEFAULT_SPEED;
    let input = text;
    if (preserveEmotions) {
      const detectedEmotions = this.detectEmotions(text);
      if (detectedEmotions.length > 0) {
        const topEmotion = detectedEmotions[0];
        const adjusted = this.adjustSpeechParams(topEmotion.emotion, text, language, v, s);
        v = adjusted.voice;
        s = adjusted.speed;
        input = topEmotion.confidence > MIN_CONFIDENCE_FOR_FORMATTING ? this.formatInputForEmotion(adjusted.input, topEmotion.emotion) : adjusted.input;
      }
    }
    return { voice: v, speed: s, input };
  }

  private async callOpenAIAPI(voice: string, speed: number, input: string): Promise<Buffer> {
    try {
      const apiPayload = { model: DEFAULT_TTS_MODEL, input, voice: voice as any, response_format: TTS_RESPONSE_FORMAT as 'mp3', speed };
      const response = await this.openai.audio.speech.create(apiPayload);
      return Buffer.from(await response.arrayBuffer());
    } catch (error) {
      console.error('[OpenAITTSService] callOpenAIAPI error:', error, error instanceof Error ? error.stack : undefined);
      throw { name: 'OpenAITTSServiceError', message: error instanceof Error ? error.message : 'Unknown error', originalError: error, stack: error instanceof Error ? error.stack : undefined };
    }
  }

  private isOpenAIError(error: any): boolean {
    if (!error) return false;
    
    const errorMessage = error.message?.toLowerCase() || '';
    const errorStatus = error.status || error.code;
    
    // HTTP status codes that should trigger fallback
    const fallbackStatusCodes = [
      401, // Unauthorized (invalid API key)
      402, // Payment Required (billing issue)
      403, // Forbidden (quota exceeded, access denied)
      429, // Too Many Requests (rate limit)
      500, // Internal Server Error
      502, // Bad Gateway
      503, // Service Unavailable
      504  // Gateway Timeout
    ];
    
    // Check status codes
    if (fallbackStatusCodes.includes(errorStatus)) {
      console.log(`[OpenAI TTS] API error detected - Status Code: ${errorStatus}`);
      return true;
    }
    
    // Check error message patterns
    const fallbackErrorPatterns = [
      'rate limit', 'quota', 'billing', 'payment',
      'unauthorized', 'forbidden', 'invalid api key',
      'service unavailable', 'timeout', 'network error',
      'openai'
    ];
    
    return fallbackErrorPatterns.some(pattern => errorMessage.includes(pattern));
  }

  private mapLanguageToVoice(language: string = 'en-US', voiceGender: string = 'female'): string {
    // Voice mapping for different languages and genders
    // OpenAI TTS supports: alloy, echo, fable, onyx, nova, shimmer
    const voiceMap: Record<string, Record<string, string>> = {
      'en-US': {
        'female': 'nova',    // Natural, versatile female voice
        'male': 'onyx'       // Deep, masculine voice
      },
      'en-GB': {
        'female': 'shimmer', // Warm, expressive female voice
        'male': 'echo'       // Refined male voice
      },
      'fr-FR': {
        'female': 'alloy',   // Neutral, balanced voice
        'male': 'echo'       // Works well for French
      },
      'es-ES': {
        'female': 'nova',    // Good for Spanish
        'male': 'onyx'       // Deep voice for Spanish
      },
      'de-DE': {
        'female': 'shimmer', // Expressive for German
        'male': 'echo'       // Clear for German
      }
    };

    return voiceMap[language]?.[voiceGender] || 'nova'; // Default to nova
  }

  public async synthesize(
    text: string,
    options: {
      language?: string;
      voice?: string;
      speed?: number;
      preserveEmotions?: boolean;
      emotionContext?: any;
    } = {}
  ): Promise<TTSResult> {
    const ttsServiceType = 'openai';
    if (!this.isInitialized) {
      throw new Error('OpenAI TTS service not initialized');
    }
    if (!text || text.trim().length === 0) {
      return { audioBuffer: Buffer.alloc(0), error: 'Text cannot be empty', ttsServiceType };
    }
    const language = options.language || 'en-US';
    const voice = options.voice || 'nova';
    const speed = options.speed || 1.0;
    const preserveEmotions = options.preserveEmotions !== false;
    // Process emotions and get adjusted parameters
    const { voice: selectedVoice, speed: selectedSpeed, input } = this.processEmotions(text, language, voice, speed, preserveEmotions);
    const cacheKey = this.generateCacheKey(input, language, selectedVoice, selectedSpeed, preserveEmotions);
    // Try cache
    const cachedAudio = await this.getCachedAudio(cacheKey);
    if (cachedAudio) {
      return { audioBuffer: cachedAudio, audioUrl: undefined, ttsServiceType };
    }
    try {
      const audioBuffer = await this.callOpenAIAPI(selectedVoice, selectedSpeed, input);
      if (audioBuffer && audioBuffer.length > 0) {
        await this.cacheAudio(cacheKey, audioBuffer);
        return { audioBuffer, audioUrl: undefined, ttsServiceType };
      } else {
        throw new Error('OpenAI TTS returned no audio data');
      }
    } catch (error) {
      console.error('[OpenAI TTS] Synthesis failed:', error);
      let errObj: { name: string; message: string };
      if (typeof error === 'object' && error !== null && typeof (error as any).name === 'string' && typeof (error as any).message === 'string') {
        errObj = { name: (error as any).name, message: (error as any).message };
      } else {
        errObj = { name: 'OpenAITTSServiceError', message: String(error) };
      }
      throw error;
    }
  }

  public async getAvailableVoices(): Promise<Array<{ name: string; id: string; language: string; gender: string }>> {
    // Return OpenAI TTS available voices
    return [
      { name: 'Alloy', id: 'alloy', language: 'multi', gender: 'neutral' },
      { name: 'Echo', id: 'echo', language: 'multi', gender: 'male' },
      { name: 'Fable', id: 'fable', language: 'multi', gender: 'male' },
      { name: 'Onyx', id: 'onyx', language: 'multi', gender: 'male' },
      { name: 'Nova', id: 'nova', language: 'multi', gender: 'female' },
      { name: 'Shimmer', id: 'shimmer', language: 'multi', gender: 'female' }
    ];
  }
}
