/**
 * TTS Service Factory with Auto-Fallback Support
 * Manages TTS service creation and automatic fallback mechanisms
 */

import { ElevenLabsTTSService } from './ElevenLabsTTSService';
import { ITTSService, TTSResult } from './TTSService';
import { BrowserTTSService } from './BrowserTTSService';
import { OpenAITTSService } from './OpenAITTSService';

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
    console.log('[AutoFallback TTS] 3-tier service initialized: ElevenLabs → OpenAI → Browser TTS');
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

  public async synthesize(text: string, options: { language?: string; voice?: string } = {}): Promise<TTSResult> {
    if (!text || text.trim().length === 0) {
      return { 
        error: 'Text cannot be empty', 
        ttsServiceType: 'invalid',
        audioBuffer: Buffer.alloc(0)
      };
    }

    console.log('[AutoFallback TTS] synthesize called', { text, options });

    let lastError: any = undefined;

    // 1. Try Primary Service (ElevenLabs TTS)
    if (this.shouldUseService(this.primaryCircuitBreaker, 'Primary (ElevenLabs)')) {
      try {
        console.log('[AutoFallback TTS] Attempting primary service (ElevenLabs TTS)');
        const result = await this.primaryService.synthesize(text, options);
        console.log('[AutoFallback TTS] ElevenLabsTTSService result:', result);
        if (!result.error && result.audioBuffer && result.audioBuffer.length > 0) {
          this.updateCircuitBreaker(this.primaryCircuitBreaker, true, 'Primary (ElevenLabs)');
          console.log('[AutoFallback TTS] Primary service succeeded and selected');
          if (result && result.ttsServiceType && result.ttsServiceType !== 'auto') return result;
          // fallback: if provider didn't set, set to 'elevenlabs'
          return { ...result, ttsServiceType: 'elevenlabs' };
        } else {
          // Treat as failure and trigger fallback
          lastError = result.error || 'No audio data returned';
          this.updateCircuitBreaker(this.primaryCircuitBreaker, false, 'Primary (ElevenLabs)');
          console.warn('[AutoFallback TTS] Primary service returned error or no audio, triggering fallback:', lastError);
          // Continue to secondary service
        }
      } catch (error) {
        lastError = error;
        console.log('[AutoFallback TTS] Primary service failed:', error instanceof Error ? error.message : String(error));
        if (this.shouldTriggerFallback(error)) {
          this.updateCircuitBreaker(this.primaryCircuitBreaker, false, 'Primary (ElevenLabs)');
          console.log('[AutoFallback TTS] Fallback triggered from primary service due to error:', error instanceof Error ? error.message : String(error), error);
          // Continue to secondary service
        } else {
          // Don't trigger fallback for non-recoverable errors
          console.log('[AutoFallback TTS] No fallback triggered, error not recoverable.', error);
          return { 
            error: error instanceof Error ? error.message : String(error), 
            ttsServiceType: 'elevenlabs',
            audioBuffer: Buffer.alloc(0)
          };
        }
      }
    } else {
      console.log('[AutoFallback TTS] Primary service circuit breaker open, skipping to secondary');
    }

    // 2. Try Secondary Service (OpenAI)
    if (this.shouldUseService(this.secondaryCircuitBreaker, 'Secondary (OpenAI)')) {
      try {
        console.log('[AutoFallback TTS] Attempting secondary service (OpenAI)');
        const result = await this.secondaryService.synthesize(text, options);
        if (!result.error && result.audioBuffer && result.audioBuffer.length > 0) {
          this.updateCircuitBreaker(this.secondaryCircuitBreaker, true, 'Secondary (OpenAI)');
          console.log('[AutoFallback TTS] Secondary service succeeded and selected');
          if (result && result.ttsServiceType && result.ttsServiceType !== 'auto') return result;
          return { ...result, ttsServiceType: 'openai' };
        } else {
          // Treat as failure and trigger fallback
          lastError = result.error || 'No audio data returned';
          this.updateCircuitBreaker(this.secondaryCircuitBreaker, false, 'Secondary (OpenAI)');
          console.warn('[AutoFallback TTS] Secondary service returned error or no audio, triggering fallback:', lastError);
          // Continue to final fallback
        }
      } catch (error) {
        lastError = error;
        console.log('[AutoFallback TTS] Secondary service failed:', error instanceof Error ? error.message : String(error));
        if (this.shouldTriggerFallback(error)) {
          this.updateCircuitBreaker(this.secondaryCircuitBreaker, false, 'Secondary (OpenAI)');
          console.log('[AutoFallback TTS] Fallback triggered from secondary service due to error:', error instanceof Error ? error.message : String(error));
          // Continue to final fallback
        } else {
          // Don't trigger fallback for non-recoverable errors
          console.log('[AutoFallback TTS] No fallback triggered, error not recoverable.');
          return { 
            error: error instanceof Error ? error.message : String(error), 
            ttsServiceType: 'openai',
            audioBuffer: Buffer.alloc(0)
          };
        }
      }
    } else {
      console.log('[AutoFallback TTS] Secondary service circuit breaker open, skipping to final fallback');
    }

    // 3. Final Fallback Service (Browser TTS)
    console.log('[AutoFallback TTS] Using final fallback service (Browser TTS)');
    try {
      const result = await this.finalFallbackService.synthesize(text, options);
      console.log('[AutoFallback TTS] Final fallback service succeeded and selected');
      if (result && result.ttsServiceType && result.ttsServiceType !== 'auto') return result;
      // If browser fallback also failed, propagate the last error from previous attempts if present
      if (result && result.error) {
        // Throw error as expected by integration tests
        throw (typeof result.error === 'object' && result.error !== null) ? result.error : { name: 'TextToSpeechError', message: String(result.error) };
      } else if (lastError) {
        // Always throw a proper error object
        let errObj: { name: string; message: string };
        if (lastError instanceof Error) {
          errObj = { name: lastError.name || 'AutoFallbackTTSServiceError', message: lastError.message || '' };
        } else if (typeof lastError === 'object' && lastError !== null && typeof (lastError as any).message === 'string') {
          errObj = { name: typeof (lastError as any).name === 'string' ? (lastError as any).name : 'AutoFallbackTTSServiceError', message: (lastError as any).message };
        } else {
          errObj = { name: 'AutoFallbackTTSServiceError', message: String(lastError) };
        }
        throw errObj;
      } else {
        throw { name: 'AutoFallbackTTSServiceError', message: 'All TTS services failed' };
      }
    } catch (error) {
      console.error('[AutoFallback TTS] All services failed, including final fallback:', error);
      let errObj: { name: string; message: string };
      if (error instanceof Error) {
        errObj = { name: error.name || 'AutoFallbackTTSServiceError', message: error.message || '' };
      } else if (typeof error === 'object' && error !== null && typeof (error as any).message === 'string') {
        errObj = { name: typeof (error as any).name === 'string' ? (error as any).name : 'AutoFallbackTTSServiceError', message: (error as any).message };
      } else {
        errObj = { name: 'AutoFallbackTTSServiceError', message: String(error) };
      }
      return { 
        error: errObj, 
        ttsServiceType: 'browser',
        audioBuffer: Buffer.alloc(0)
      };
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
    // Detailed logging for debugging service selection and environment
    console.log('[TTSFactory] createTTSService called with type:', type);
    console.log('[TTSFactory] ENV TTS_SERVICE_TYPE:', process.env.TTS_SERVICE_TYPE);
    console.log('[TTSFactory] ENV ELEVENLABS_API_KEY:', process.env.ELEVENLABS_API_KEY ? '[REDACTED]' : '[MISSING]');
    if (this.instances.has(type)) {
      console.log(`[TTSFactory] Returning cached ${type} service`);
      return this.instances.get(type)!;
    }

    let service: ITTSService;

    switch (type.toLowerCase()) {
      case 'openai':
        console.log('[TTSFactory] Explicitly requested OpenAI TTS');
        service = new OpenAITTSService();
        break;

      case 'elevenlabs': {
        const elevenLabsApiKey = process.env.ELEVENLABS_API_KEY;
        console.log('[TTSFactory] Explicitly requested ElevenLabs TTS. API Key present:', !!elevenLabsApiKey);
        if (!elevenLabsApiKey) {
          console.warn('[TTSFactory] ELEVENLABS_API_KEY not found for elevenlabs service, falling back to auto-fallback');
          const openaiService = new OpenAITTSService();
          const browserService = new BrowserTTSService();
          service = new AutoFallbackTTSService(openaiService, browserService, browserService);
        } else {
          service = new ElevenLabsTTSService(elevenLabsApiKey);
        }
        break;
      }

      case 'browser':
        console.log('[TTSFactory] Explicitly requested Browser TTS');
        service = new BrowserTTSService();
        break;

      case 'auto':
      default: {
        console.log('[TTSFactory] Creating 3-tier auto-fallback TTS service: ElevenLabs → OpenAI → Browser');
        const elevenLabsKey = process.env.ELEVENLABS_API_KEY;
        console.log('[TTSFactory] Auto mode. ELEVENLABS_API_KEY present:', !!elevenLabsKey);
        const elevenLabsPrimary = elevenLabsKey
          ? new ElevenLabsTTSService(elevenLabsKey)
          : new BrowserTTSService();
        const openaiSecondary = new OpenAITTSService();
        const browserFinal = new BrowserTTSService();
        // Order: ElevenLabs (primary), OpenAI (secondary), Browser (final)
        service = new AutoFallbackTTSService(elevenLabsPrimary, openaiSecondary, browserFinal);
        break;
      }
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
