/**
 * TTS Service Factory with Auto-Fallback Support
 * Manages TTS service creation and automatic fallback mechanisms
 */

import { ElevenLabsTTSService, ITTSService } from './ElevenLabsTTSService.js';
import { BrowserTTSService } from './BrowserTTSService.js';
import { OpenAITTSService } from './OpenAITTSService.js';

interface CircuitBreakerState {
  failures: number;
  lastFailureTime: number;
  isOpen: boolean;
  nextRetryTime: number;
}

export class AutoFallbackTTSService implements ITTSService {
  private primaryService: ITTSService;
  private secondaryService: ITTSService;
  private finalFallbackService: ITTSService;
  private primaryCircuitBreaker: CircuitBreakerState;
  private secondaryCircuitBreaker: CircuitBreakerState;
  private readonly maxFailures: number = 3;
  private readonly baseRetryDelay: number = 5 * 60 * 1000; // 5 minutes
  private readonly maxRetryDelay: number = 25 * 60 * 1000; // 25 minutes

  constructor(primaryService: ITTSService, secondaryService: ITTSService, finalFallbackService: ITTSService) {
    this.primaryService = primaryService;
    this.secondaryService = secondaryService;
    this.finalFallbackService = finalFallbackService;
    this.primaryCircuitBreaker = {
      failures: 0,
      lastFailureTime: 0,
      isOpen: false,
      nextRetryTime: 0
    };
    this.secondaryCircuitBreaker = {
      failures: 0,
      lastFailureTime: 0,
      isOpen: false,
      nextRetryTime: 0
    };
    
    console.log('[AutoFallback TTS] 3-tier service initialized: OpenAI → ElevenLabs → Browser TTS');
  }

  private updateCircuitBreaker(circuitBreaker: CircuitBreakerState, success: boolean, serviceName: string): void {
    if (success) {
      // Reset circuit breaker on success
      if (circuitBreaker.failures > 0) {
        console.log(`[AutoFallback TTS] ${serviceName} circuit breaker reset - service recovered`);
      }
      circuitBreaker.failures = 0;
      circuitBreaker.isOpen = false;
      circuitBreaker.nextRetryTime = 0;
    } else {
      // Increment failures and potentially open circuit
      circuitBreaker.failures++;
      circuitBreaker.lastFailureTime = Date.now();
      
      if (circuitBreaker.failures >= this.maxFailures) {
        circuitBreaker.isOpen = true;
        
        // Calculate exponential backoff
        const retryDelay = Math.min(
          this.baseRetryDelay * Math.pow(2, circuitBreaker.failures - this.maxFailures),
          this.maxRetryDelay
        );
        
        circuitBreaker.nextRetryTime = Date.now() + retryDelay;
        
        console.log(`[AutoFallback TTS] ${serviceName} circuit breaker opened - next retry in ${Math.round(retryDelay / 60000)} minutes`);
      }
    }
  }

  private shouldUseService(circuitBreaker: CircuitBreakerState, serviceName: string): boolean {
    if (!circuitBreaker.isOpen) {
      return true;
    }
    
    // Check if it's time to retry the service
    if (Date.now() >= circuitBreaker.nextRetryTime) {
      console.log(`[AutoFallback TTS] ${serviceName} circuit breaker allowing retry attempt`);
      return true;
    }
    
    return false;
  }

  private shouldTriggerFallback(error: any): boolean {
    if (!error) return false;
    
    // Check if error has explicit fallback flag
    if (error.shouldFallback === true) {
      return true;
    }
    
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

  public async synthesize(text: string, options: { language?: string; voice?: string } = {}): Promise<{ audioBuffer?: Buffer; audioUrl?: string; error?: string }> {
    if (!text || text.trim().length === 0) {
      throw new Error('Text cannot be empty');
    }

    // 1. Try Primary Service (OpenAI TTS)
    if (this.shouldUseService(this.primaryCircuitBreaker, 'Primary (OpenAI)')) {
      try {
        console.log('[AutoFallback TTS] Attempting primary service (OpenAI TTS)');
        const result = await this.primaryService.synthesize(text, options);
        
        this.updateCircuitBreaker(this.primaryCircuitBreaker, true, 'Primary (OpenAI)');
        console.log('[AutoFallback TTS] Primary service succeeded');
        return result;
        
      } catch (error) {
        console.log('[AutoFallback TTS] Primary service failed:', error instanceof Error ? error.message : String(error));
        
        if (this.shouldTriggerFallback(error)) {
          this.updateCircuitBreaker(this.primaryCircuitBreaker, false, 'Primary (OpenAI)');
          // Continue to secondary service
        } else {
          // Don't trigger fallback for non-recoverable errors
          throw error;
        }
      }
    }

    // 2. Try Secondary Service (ElevenLabs)
    if (this.shouldUseService(this.secondaryCircuitBreaker, 'Secondary (ElevenLabs)')) {
      try {
        console.log('[AutoFallback TTS] Attempting secondary service (ElevenLabs)');
        const result = await this.secondaryService.synthesize(text, options);
        
        this.updateCircuitBreaker(this.secondaryCircuitBreaker, true, 'Secondary (ElevenLabs)');
        console.log('[AutoFallback TTS] Secondary service succeeded');
        return result;
        
      } catch (error) {
        console.log('[AutoFallback TTS] Secondary service failed:', error instanceof Error ? error.message : String(error));
        
        if (this.shouldTriggerFallback(error)) {
          this.updateCircuitBreaker(this.secondaryCircuitBreaker, false, 'Secondary (ElevenLabs)');
          // Continue to final fallback
        } else {
          // Don't trigger fallback for non-recoverable errors
          throw error;
        }
      }
    } else {
      console.log('[AutoFallback TTS] Secondary service circuit breaker open, skipping to final fallback');
    }

    // 3. Final Fallback Service (Browser TTS)
    console.log('[AutoFallback TTS] Using final fallback service (Browser TTS)');
    try {
      const result = await this.finalFallbackService.synthesize(text, options);
      console.log('[AutoFallback TTS] Final fallback service succeeded');
      return result;
    } catch (error) {
      console.error('[AutoFallback TTS] All services failed, including final fallback:', error);
      throw new Error(`All TTS services failed. Primary: OpenAI TTS failed. Secondary: ElevenLabs failed. Final: Browser TTS failed - ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  public getCircuitBreakerStatus(): { 
    primary: { isOpen: boolean; failures: number; nextRetryTime: number };
    secondary: { isOpen: boolean; failures: number; nextRetryTime: number };
  } {
    return {
      primary: {
        isOpen: this.primaryCircuitBreaker.isOpen,
        failures: this.primaryCircuitBreaker.failures,
        nextRetryTime: this.primaryCircuitBreaker.nextRetryTime
      },
      secondary: {
        isOpen: this.secondaryCircuitBreaker.isOpen,
        failures: this.secondaryCircuitBreaker.failures,
        nextRetryTime: this.secondaryCircuitBreaker.nextRetryTime
      }
    };
  }

  public resetCircuitBreakers(): void {
    console.log('[AutoFallback TTS] All circuit breakers manually reset');
    this.primaryCircuitBreaker.failures = 0;
    this.primaryCircuitBreaker.isOpen = false;
    this.primaryCircuitBreaker.nextRetryTime = 0;
    
    this.secondaryCircuitBreaker.failures = 0;
    this.secondaryCircuitBreaker.isOpen = false;
    this.secondaryCircuitBreaker.nextRetryTime = 0;
  }
}

export class TTSServiceFactory {
  private static instances = new Map<string, ITTSService>();

  public static createTTSService(type: string = 'auto'): ITTSService {
    // Check for cached instance
    if (this.instances.has(type)) {
      console.log(`[TTSFactory] Returning cached ${type} service`);
      return this.instances.get(type)!;
    }

    let service: ITTSService;

    switch (type.toLowerCase()) {
      case 'openai':
        service = new OpenAITTSService();
        break;

      case 'elevenlabs':
        const elevenLabsApiKey = process.env.ELEVENLABS_API_KEY;
        if (!elevenLabsApiKey) {
          console.warn('[TTSFactory] ELEVENLABS_API_KEY not found for elevenlabs service, falling back to auto-fallback');
          // Create 3-tier fallback: OpenAI → ElevenLabs (unavailable) → Browser
          const openaiService = new OpenAITTSService();
          const browserService = new BrowserTTSService();
          service = new AutoFallbackTTSService(openaiService, browserService, browserService);
        } else {
          service = new ElevenLabsTTSService(elevenLabsApiKey);
        }
        break;

      case 'browser':
        service = new BrowserTTSService();
        break;

      case 'auto':
      default:
        console.log('[TTSFactory] Creating 3-tier auto-fallback TTS service: OpenAI → ElevenLabs → Browser');
        
        // Create 3-tier fallback system
        const openaiPrimary = new OpenAITTSService();
        
        const elevenLabsKey = process.env.ELEVENLABS_API_KEY;
        const elevenLabsSecondary = elevenLabsKey 
          ? new ElevenLabsTTSService(elevenLabsKey)
          : new BrowserTTSService(); // If no ElevenLabs key, use Browser as secondary
          
        const browserFinal = new BrowserTTSService();
        
        service = new AutoFallbackTTSService(openaiPrimary, elevenLabsSecondary, browserFinal);
        break;
    }

    // Cache the service instance
    this.instances.set(type, service);
    console.log(`[TTSFactory] Created and cached ${type} service`);
    
    return service;
  }

  public static clearCache(): void {
    console.log('[TTSFactory] Clearing service cache');
    this.instances.clear();
  }

  public static getCachedServices(): string[] {
    return Array.from(this.instances.keys());
  }
}

// Convenience function for tests and direct usage
export function getTTSService(type?: string): ITTSService {
  const serviceType = type || process.env.TTS_SERVICE_TYPE || 'auto';
  return TTSServiceFactory.createTTSService(serviceType);
}
