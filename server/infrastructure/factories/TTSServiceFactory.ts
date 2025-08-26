/**
 * TTS Service Factory with Quality-Optimized 4-Tier Architecture  
 * Implements SOLID principles with Strategy and Factory patterns
 * 
 * QUALITY-OPTIMIZED ORDER (OPENAI FIRST):
 * Tier 1 (PAID): OpenAI TTS - Highest quality
 * Tier 2 (PAID): ElevenLabs TTS - Premium quality
 * Tier 3 (FREE): Local eSpeak-NG - Good quality, local processing
 * Tier 4 (FREE): Browser TTS - Client-side processing
 */

import { ITTSService, TTSResult } from '../../services/tts/TTSService';
import { ElevenLabsTTSService } from '../external-services/tts/ElevenLabsTTSService';
import { OpenAITTSService } from '../external-services/tts/OpenAITTSService';
import { LocalTTSService } from '../external-services/tts/LocalTTSService';
import { PiperTTSService } from '../external-services/tts/PiperTTSService';
import { BrowserTTSService } from '../external-services/tts/BrowserTTSService';
import { SilentTTSService } from '../external-services/tts/SilentTTSService';
import KartoffelTTSService from '../external-services/tts/KartoffelTTSService';
import KokoroTTSService from '../external-services/tts/KokoroTTSService';
import { KartoffelTTSService } from '../external-services/tts/KartoffelTTSService';

// Service tier enumeration for consistency
export enum TTSServiceTier {
  PREMIUM_ELEVENLABS = 'premium-labs',   // Tier 1a: ElevenLabs TTS (paid)
  PREMIUM_OPENAI = 'premium-openai',     // Tier 1b: OpenAI TTS (paid)
  HIGH_QUALITY_FREE = 'free-hq',        // Tier 2: Local eSpeak-NG (free, high quality)
  BASIC_FREE = 'free-basic',             // Tier 3: Browser TTS (free, basic)
  SILENT = 'silent',                     // Tier 4: Silent mode (no audio)
  KARTOFFEL = 'kartoffel',               // Special: Hugging Face open TTS (German focus)
  AUTO = 'auto'                          // Auto-fallback through all tiers
}

interface ITTSServiceFactory {
  createService(tier: TTSServiceTier): ITTSService;
  getAvailableTiers(): TTSServiceTier[];
  clearCache(): void;
}

interface CircuitBreakerState {
  failures: number;
  lastFailureTime: number;
  isOpen: boolean;
  nextRetryTime: number;
}

export class AutoFallbackTTSService implements ITTSService {
  private primaryService: ITTSService | null;
  private secondaryService: ITTSService | null;
  private tertiaryService: ITTSService | null;
  private finalFallbackService: ITTSService;
  private primaryCircuitBreaker: CircuitBreakerState;
  private secondaryCircuitBreaker: CircuitBreakerState;
  private tertiaryCircuitBreaker: CircuitBreakerState;
  private readonly maxFailures: number = 3;
  private readonly baseRetryDelay: number = 5 * 60 * 1000; // 5 minutes
  private readonly maxRetryDelay: number = 25 * 60 * 1000; // 25 minutes

  constructor(
    primaryService: ITTSService | null,
    secondaryService: ITTSService | null,
    tertiaryService: ITTSService | null,
    finalFallbackService: ITTSService
  ) {
    this.primaryService = primaryService;
    this.secondaryService = secondaryService;
    this.tertiaryService = tertiaryService;
    this.finalFallbackService = finalFallbackService;
    
    this.primaryCircuitBreaker = this.createCircuitBreakerState();
    this.secondaryCircuitBreaker = this.createCircuitBreakerState();
    this.tertiaryCircuitBreaker = this.createCircuitBreakerState();
    
    console.log('[AutoFallback TTS] 4-tier service initialized: Local (FREE) → Browser (FREE) → OpenAI (PAID) → ElevenLabs (EXPENSIVE)');
  }

  private createCircuitBreakerState(): CircuitBreakerState {
    return {
      failures: 0,
      lastFailureTime: 0,
      isOpen: false,
      nextRetryTime: 0
    };
  }

  private updateCircuitBreaker(circuitBreaker: CircuitBreakerState, success: boolean, serviceName: string): void {
    if (success) {
      // Reset circuit breaker on success
      if (circuitBreaker.failures > 0) {
        console.log(`[AutoFallback TTS] ${serviceName} recovered, resetting circuit breaker`);
      }
      circuitBreaker.failures = 0;
      circuitBreaker.isOpen = false;
      circuitBreaker.nextRetryTime = 0;
    } else {
      // Increment failures and potentially open circuit breaker
      circuitBreaker.failures++;
      circuitBreaker.lastFailureTime = Date.now();
      
      if (circuitBreaker.failures >= this.maxFailures) {
        circuitBreaker.isOpen = true;
        const retryDelay = Math.min(
          this.baseRetryDelay * Math.pow(2, circuitBreaker.failures - this.maxFailures),
          this.maxRetryDelay
        );
        circuitBreaker.nextRetryTime = Date.now() + retryDelay;
        console.warn(`[AutoFallback TTS] ${serviceName} circuit breaker opened, retry in ${Math.round(retryDelay / 60000)} minutes`);
      }
    }
  }

  private shouldSkipService(circuitBreaker: CircuitBreakerState): boolean {
    if (!circuitBreaker.isOpen) return false;
    
    if (Date.now() >= circuitBreaker.nextRetryTime) {
      console.log('[AutoFallback TTS] Circuit breaker retry time reached, attempting service');
      return false;
    }
    
    return true;
  }

  private shouldTriggerFallback(error: any): boolean {
    if (!error) return false;
    
    const errorMessage = error.message?.toLowerCase() || '';
    const errorStatus = error.status || error.code;
    
    // HTTP status codes that should trigger fallback
    const fallbackStatusCodes = [401, 402, 403, 429, 500, 502, 503, 504];
    if (fallbackStatusCodes.includes(errorStatus)) {
      return true;
    }
    
    // Error message patterns that should trigger fallback
    const fallbackErrorPatterns = [
      'rate limit', 'quota', 'billing', 'payment',
      'unauthorized', 'forbidden', 'invalid api key',
      'service unavailable', 'timeout', 'network error',
      'elevenlabs', 'openai'
    ];
    
    return fallbackErrorPatterns.some(pattern => errorMessage.includes(pattern));
  }

  async synthesize(text: string, options: { language?: string; voice?: string } = {}): Promise<TTSResult> {
    if (!text || text.trim().length === 0) {
      return { 
        error: 'Text cannot be empty', 
        ttsServiceType: 'invalid',
        audioBuffer: Buffer.alloc(0)
      };
    }

    console.log('[AutoFallback TTS] synthesize called', { text, options });

    // Try primary service (Premium)
    if (this.primaryService && !this.shouldSkipService(this.primaryCircuitBreaker)) {
      try {
        console.log('[AutoFallback TTS] Attempting primary service (Premium)');
        const result = await this.primaryService.synthesize(text, options);
        this.updateCircuitBreaker(this.primaryCircuitBreaker, true, 'Primary');
        console.log('[AutoFallback TTS] Primary service succeeded');
        return result;
      } catch (error) {
        const shouldFallback = this.shouldTriggerFallback(error);
        this.updateCircuitBreaker(this.primaryCircuitBreaker, false, 'Primary');
        console.warn('[AutoFallback TTS] Primary service failed:', error instanceof Error ? error.message : error, 'Fallback:', shouldFallback);
        if (!shouldFallback) throw error;
      }
    }

    // Try secondary service (High-Quality Free)
    if (this.secondaryService && !this.shouldSkipService(this.secondaryCircuitBreaker)) {
      try {
        console.log('[AutoFallback TTS] Attempting secondary service (High-Quality Free)');
        const result = await this.secondaryService.synthesize(text, options);
        this.updateCircuitBreaker(this.secondaryCircuitBreaker, true, 'Secondary');
        console.log('[AutoFallback TTS] Secondary service succeeded');
        return result;
      } catch (error) {
        const shouldFallback = this.shouldTriggerFallback(error);
        this.updateCircuitBreaker(this.secondaryCircuitBreaker, false, 'Secondary');
        console.warn('[AutoFallback TTS] Secondary service failed:', error instanceof Error ? error.message : error, 'Fallback:', shouldFallback);
        if (!shouldFallback) throw error;
      }
    }

    // Try tertiary service (Basic Free)
    if (this.tertiaryService && !this.shouldSkipService(this.tertiaryCircuitBreaker)) {
      try {
        console.log('[AutoFallback TTS] Attempting tertiary service (Basic Free)');
        const result = await this.tertiaryService.synthesize(text, options);
        this.updateCircuitBreaker(this.tertiaryCircuitBreaker, true, 'Tertiary');
        console.log('[AutoFallback TTS] Tertiary service succeeded');
        return result;
      } catch (error) {
        const shouldFallback = this.shouldTriggerFallback(error);
        this.updateCircuitBreaker(this.tertiaryCircuitBreaker, false, 'Tertiary');
        console.warn('[AutoFallback TTS] Tertiary service failed:', error instanceof Error ? error.message : error, 'Fallback:', shouldFallback);
        if (!shouldFallback) throw error;
      }
    }

    // Final fallback (Silent/Error)
    try {
      console.log('[AutoFallback TTS] Using final fallback service');
      const result = await this.finalFallbackService.synthesize(text, options);
      console.log('[AutoFallback TTS] Final fallback service succeeded');
      return result;
    } catch (error) {
      console.error('[AutoFallback TTS] All TTS services failed:', error instanceof Error ? error.message : error);
      return {
        audioBuffer: Buffer.alloc(0),
        error: `All TTS services failed. Last error: ${error instanceof Error ? error.message : String(error)}`,
        ttsServiceType: 'failed'
      };
    }
  }
}

export class TTSServiceFactory implements ITTSServiceFactory {
  private static instances = new Map<string, ITTSService>();

  // Instance methods to implement interface
  createService(tier: TTSServiceTier): ITTSService {
    return TTSServiceFactory.createTTSService(tier);
  }

  getAvailableTiers(): TTSServiceTier[] {
    return TTSServiceFactory.getAvailableTiers();
  }

  clearCache(): void {
    TTSServiceFactory.clearCache();
  }

  // Static methods for backward compatibility
  public static createTTSService(type: string = 'auto'): ITTSService {
    const normalized = (type || 'auto').toLowerCase();
    // Direct support for Kartoffel TTS regardless of tier system
    if (normalized === 'kartoffel') {
      return new KartoffelTTSService();
    }
    // Direct support for Kokoro TTS
    if (normalized === 'kokoro') {
      return new KokoroTTSService();
    }
    const tier = this.mapTypeToTier(type);
    const cacheKey = tier;
    
    if (this.instances.has(cacheKey)) {
      console.log(`[TTSFactory] Returning cached ${tier} service`);
      return this.instances.get(cacheKey)!;
    }

    let service: ITTSService;

    switch (tier) {
      case TTSServiceTier.KARTOFFEL: {
        console.log('[TTSFactory] Creating Kartoffel (Hugging Face) TTS');
        service = new KartoffelTTSService();
        break;
      }
      case TTSServiceTier.PREMIUM_ELEVENLABS: {
        const apiKey = process.env.ELEVENLABS_API_KEY;
        if (!apiKey) {
          throw new Error('ELEVENLABS_API_KEY is required for Premium ElevenLabs TTS tier');
        }
        console.log('[TTSFactory] Creating Tier 1a (Premium): ElevenLabs TTS');
        service = new ElevenLabsTTSService(apiKey);
        break;
      }

      case TTSServiceTier.PREMIUM_OPENAI: {
        console.log('[TTSFactory] Creating Tier 1b (Premium): OpenAI TTS');
        service = new OpenAITTSService();
        break;
      }

      case TTSServiceTier.HIGH_QUALITY_FREE: {
        // Prefer Piper where available; fallback to Local eSpeak-NG to guarantee coverage
        const piper = new PiperTTSService();
        if (piper.isAvailable()) {
          console.log('[TTSFactory] Creating Tier 2 (High-Quality Free): Piper TTS');
          service = piper as unknown as ITTSService;
        } else {
          console.log('[TTSFactory] Piper not available; falling back to Local eSpeak-NG TTS');
          service = new LocalTTSService();
        }
        break;
      }

      case TTSServiceTier.BASIC_FREE: {
        console.log('[TTSFactory] Creating Tier 3 (Basic Free): Browser TTS');
        service = new BrowserTTSService();
        break;
      }

      case TTSServiceTier.SILENT: {
        console.log('[TTSFactory] Creating Tier 4 (Silent): No audio output');
        service = new SilentTTSService();
        break;
      }

      case TTSServiceTier.AUTO:
      default: {
        console.log('[TTSFactory] Creating 4-tier auto-fallback: OpenAI (PAID) → ElevenLabs (PAID) → Local (FREE) → Browser (FREE)');
        service = this.createAutoFallbackService();
        break;
      }
    }

    this.instances.set(cacheKey, service);
    console.log(`[TTSFactory] Created and cached ${tier} service`);
    return service;
  }

  private static createAutoFallbackService(): ITTSService {
    const hasElevenLabs = !!process.env.ELEVENLABS_API_KEY;
    const hasOpenAI = !!process.env.OPENAI_API_KEY;

    // Create service chain based on available credentials
    let primaryService: ITTSService | null = null;
    let secondaryService: ITTSService | null = null;
    let tertiaryService: ITTSService | null = null;
    let finalFallbackService: ITTSService;

    // Primary: Kokoro (if configured) – free HF inference endpoint
    try {
      if (process.env.KOKORO_TTS_URL) {
        primaryService = new KokoroTTSService();
        console.log('[TTSFactory] Tier 0 (FREE) available: Kokoro-82M (HF)');
      }
    } catch (error) {
      console.warn('[TTSFactory] Kokoro TTS primary unavailable:', error instanceof Error ? error.message : error);
    }

    // Secondary: OpenAI (PAID)
    try {
      if (hasOpenAI) {
        if (!primaryService) {
          primaryService = new OpenAITTSService();
          console.log('[TTSFactory] Tier 1 (PAID) available: OpenAI TTS');
        } else {
          secondaryService = new OpenAITTSService();
          console.log('[TTSFactory] Tier 1 (PAID) available as secondary: OpenAI TTS');
        }
      }
    } catch (error) {
      console.warn('[TTSFactory] OpenAI TTS primary unavailable:', error instanceof Error ? error.message : error);
    }

    // Next: ElevenLabs (PAID)
    try {
      if (hasElevenLabs) {
        const svc = new ElevenLabsTTSService(process.env.ELEVENLABS_API_KEY!);
        if (!secondaryService) secondaryService = svc; else if (!tertiaryService) tertiaryService = svc;
        console.log('[TTSFactory] Tier 2 (PAID) available: ElevenLabs TTS');
      }
    } catch (error) {
      console.warn('[TTSFactory] ElevenLabs TTS secondary unavailable:', error instanceof Error ? error.message : error);
    }

    // Then: Local TTS (FREE)
    try {
      if (!tertiaryService) tertiaryService = new LocalTTSService();
      console.log('[TTSFactory] Tier 3 (FREE) available: Local TTS');
    } catch (error) {
      console.warn('[TTSFactory] Local TTS tertiary unavailable:', error instanceof Error ? error.message : error);
    }

    // Final Fallback: Browser TTS (FREE)
    try {
      finalFallbackService = new BrowserTTSService();
      console.log('[TTSFactory] Tier 4 (FREE) available: Browser TTS');
    } catch (error) {
      console.warn('[TTSFactory] Browser TTS final fallback unavailable:', error instanceof Error ? error.message : error);
      // As a last resort, provide a dummy service
      finalFallbackService = new BrowserTTSService();
    }

    // Create 4-tier fallback chain
    return new AutoFallbackTTSService(
      primaryService,
      secondaryService,
      tertiaryService,
      finalFallbackService
    );
  }

  private static mapTypeToTier(type: string): TTSServiceTier {
    const normalizedType = type.toLowerCase();
    
    switch (normalizedType) {
      case 'kartoffel':
      case 'chatterbox':
      case 'hf-kartoffel':
        return TTSServiceTier.KARTOFFEL;
      case 'elevenlabs':
      case 'premium-labs':
        return TTSServiceTier.PREMIUM_ELEVENLABS;
      
      case 'openai':
      case 'premium-openai':
        return TTSServiceTier.PREMIUM_OPENAI;
      
      case 'local':
      case 'free-hq':
      case 'high-quality':
        return TTSServiceTier.HIGH_QUALITY_FREE;
      
      case 'browser':
      case 'free-basic':
      case 'basic':
        return TTSServiceTier.BASIC_FREE;
      
      case 'silent':
      case 'none':
        return TTSServiceTier.SILENT;
      
      case 'auto':
      default:
        return TTSServiceTier.AUTO;
    }
  }

  public static getAvailableTiers(): TTSServiceTier[] {
    const tiers: TTSServiceTier[] = [];
    
    if (process.env.ELEVENLABS_API_KEY) {
      tiers.push(TTSServiceTier.PREMIUM_ELEVENLABS);
    }
    
    if (process.env.OPENAI_API_KEY) {
      tiers.push(TTSServiceTier.PREMIUM_OPENAI);
    }
    
    tiers.push(
      TTSServiceTier.HIGH_QUALITY_FREE,
      TTSServiceTier.BASIC_FREE,
      TTSServiceTier.SILENT,
      TTSServiceTier.AUTO
    );
    
    return tiers;
  }

  public static clearCache(): void {
    this.instances.clear();
    console.log('[TTSFactory] Service cache cleared');
  }

  public static getCachedServices(): string[] {
    return Array.from(this.instances.keys());
  }

  public static getServiceInfo(tier: TTSServiceTier): { 
    name: string; 
    tier: string; 
    quality: string; 
    cost: string; 
    available: boolean;
  } {
    switch (tier) {
      case TTSServiceTier.PREMIUM_ELEVENLABS:
        return {
          name: 'ElevenLabs TTS',
          tier: 'Tier 1a (Premium)',
          quality: 'Highest - Natural voice cloning, emotional control',
          cost: 'Paid API calls',
          available: !!process.env.ELEVENLABS_API_KEY
        };
      
      case TTSServiceTier.PREMIUM_OPENAI:
        return {
          name: 'OpenAI TTS',
          tier: 'Tier 1b (Premium)',
          quality: 'Highest - Multiple high-quality voices',
          cost: 'Paid API calls',
          available: !!process.env.OPENAI_API_KEY
        };
      
      case TTSServiceTier.HIGH_QUALITY_FREE:
        return {
          name: 'Local eSpeak-NG',
          tier: 'Tier 2 (High-Quality Free)',
          quality: 'Excellent - 100+ languages, local processing',
          cost: 'Local processing only',
          available: true
        };
      
      case TTSServiceTier.BASIC_FREE:
        return {
          name: 'Browser TTS',
          tier: 'Tier 3 (Basic Free)',
          quality: 'Good - Client-side Web Speech API',
          cost: 'No server costs',
          available: true
        };
      
      case TTSServiceTier.SILENT:
        return {
          name: 'Silent Mode',
          tier: 'Tier 4 (Silent)',
          quality: 'None - No audio output',
          cost: 'No costs',
          available: true
        };
      
      default:
        return {
          name: 'Auto-Fallback TTS',
          tier: 'All Tiers',
          quality: 'Adaptive - Best available quality',
          cost: 'Optimized cost with fallback',
          available: true
        };
    }
  }
}

// Export functions for SpeechPipelineOrchestrator compatibility
export function getTTSService(type?: string): ITTSService {
  // Respect explicit type arg or env when provided
  const explicit = type || process.env.TTS_SERVICE_TYPE;
  if (explicit) {
    return TTSServiceFactory.createTTSService(explicit);
  }
  // In test environment with no explicit selection, avoid local eSpeak to prevent native aborts
  const isTest = (process.env.NODE_ENV || '').toLowerCase() === 'test';
  if (isTest) {
    const forcedForTests = process.env.FORCE_TEST_TTS_SERVICE || 'browser';
    return TTSServiceFactory.createTTSService(forcedForTests);
  }
  return TTSServiceFactory.createTTSService('auto');
}
