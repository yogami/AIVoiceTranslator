import { OpenAI } from 'openai';
import { AudioTranscriptionService } from './AudioTranscriptionService.js';
import { WhisperCppTranscriptionService } from './WhisperCppTranscriptionService.js';
import { AudioFileHandler } from '../../utils/AudioFileHandler.js';

export interface ITranscriptionService {
  transcribe(audioBuffer: Buffer, options?: { language?: string }): Promise<string>;
}

/**
 * Comprehensive Auto-Fallback Transcription Service
 * Automatically falls back to WhisperCpp when OpenAI fails for any reason
 */
export class AutoFallbackTranscriptionService implements ITranscriptionService {
  private openaiService: ITranscriptionService | null = null;
  private whisperService: ITranscriptionService;
  private isOpenAIDown: boolean = false;
  private lastFailTime: number = 0;
  private failureCount: number = 0;
  private readonly RETRY_COOLDOWN_MS = 300000; // 5 minutes before retrying OpenAI

  constructor() {
    this.whisperService = new WhisperCppTranscriptionService();
    this.initializeOpenAI();
  }

  private initializeOpenAI(): void {
    const apiKey = process.env.OPENAI_API_KEY || '';
    if (apiKey) {
      try {
        const openai = new OpenAI({ apiKey });
        this.openaiService = new AudioTranscriptionService(openai);
      } catch (error) {
        console.warn('[AutoFallback STT] Failed to initialize OpenAI service:', error);
        this.openaiService = null;
      }
    }
  }

  private isOpenAIFailureError(error: any): boolean {
    if (!error) return false;
    
    const errorMessage = error.message?.toLowerCase() || '';
    const errorCode = error.status || error.code;
    
    // HTTP status codes that should trigger fallback
    const fallbackStatusCodes = [
      429, // Too Many Requests (rate limit)
      402, // Payment Required (billing issue)
      401, // Unauthorized (invalid API key)
      403, // Forbidden (quota exceeded, model access denied)
      500, // Internal Server Error
      502, // Bad Gateway  
      503, // Service Unavailable
      504, // Gateway Timeout
      400  // Bad Request (sometimes quota related)
    ];
    
    // Check status codes
    if (fallbackStatusCodes.includes(errorCode)) {
      console.log(`[AutoFallback STT] OpenAI API error detected - Status Code: ${errorCode}`);
      return true;
    }
    
    // Check error message patterns (case-insensitive)
    const fallbackErrorPatterns = [
      // Rate limiting
      'rate limit', 'too many requests', 'rate exceeded',
      
      // Quota and billing
      'quota', 'insufficient_quota', 'quota exceeded', 'billing',
      'exceeded', 'insufficient funds', 'payment required',
      'usage limit', 'monthly limit',
      
      // API key issues
      'invalid api key', 'authentication', 'unauthorized', 'api key',
      'invalid_api_key', 'incorrect api key',
      
      // Service issues
      'service unavailable', 'server error', 'internal error',
      'timeout', 'connection', 'network', 'bad gateway',
      'service overloaded', 'temporarily unavailable',
      
      // Model access issues
      'model not found', 'access denied', 'forbidden',
      'model unavailable', 'model overloaded', 'model not available',
      
      // General API issues
      'openai api', 'api error', 'request failed', 'failed to fetch',
      'network error', 'connection refused', 'connection timeout'
    ];
    
    const matchedPattern = fallbackErrorPatterns.find(pattern => 
      errorMessage.includes(pattern.toLowerCase())
    );
    
    if (matchedPattern) {
      console.log(`[AutoFallback STT] OpenAI API error detected - Pattern: "${matchedPattern}"`);
      return true;
    }
    
    return false;
  }

  private shouldRetryOpenAI(): boolean {
    if (!this.isOpenAIDown) return true;
    
    // Use exponential backoff based on failure count
    const cooldownMultiplier = Math.min(this.failureCount, 5); // Cap at 5x
    const actualCooldown = this.RETRY_COOLDOWN_MS * cooldownMultiplier;
    
    return (Date.now() - this.lastFailTime) > actualCooldown;
  }

  private markOpenAIFailure(error: any): void {
    const wasAlreadyDown = this.isOpenAIDown;
    this.isOpenAIDown = true;
    this.lastFailTime = Date.now();
    this.failureCount++;
    
    const cooldownMinutes = Math.min(this.failureCount * 5, 25); // Cap at 25 minutes
    
    if (!wasAlreadyDown) {
      console.log(`[AutoFallback STT] OpenAI marked as down. Failure #${this.failureCount}. Next retry in ${cooldownMinutes} minutes.`);
    }
  }

  private markOpenAIRecovery(): void {
    if (this.isOpenAIDown) {
      console.log(`[AutoFallback STT] OpenAI service recovered after ${this.failureCount} failures!`);
      this.isOpenAIDown = false;
      this.failureCount = 0; // Reset failure count on successful recovery
    }
  }

  public async transcribe(audioBuffer: Buffer, options?: { language?: string }): Promise<string> {
    // If OpenAI is available and not in cooldown, try it first
    if (this.openaiService && this.shouldRetryOpenAI()) {
      try {
        const result = await this.openaiService.transcribe(audioBuffer, options);
        
        // Success! Reset failure state
        this.markOpenAIRecovery();
        return result;
        
      } catch (error) {
        console.warn('[AutoFallback STT] OpenAI transcription failed:', error instanceof Error ? error.message : error);
        
        // Check if it's any OpenAI failure that should trigger fallback
        if (this.isOpenAIFailureError(error)) {
          this.markOpenAIFailure(error);
        } else {
          // For non-API errors, still fallback for this request
          console.log('[AutoFallback STT] Non-API error, falling back for this request only');
        }
        
        // Fall through to whisper fallback
      }
    }

    // Use WhisperCpp as fallback
    const reason = this.isOpenAIDown 
      ? `OpenAI in cooldown (${this.failureCount} failures)`
      : 'OpenAI unavailable';
    
    console.log(`[AutoFallback STT] Using WhisperCpp (${reason})`);
    
    return await this.whisperService.transcribe(audioBuffer, options);
  }
}

/**
 * Factory for creating transcription services
 */
export class TranscriptionServiceFactory {
  private static instance: TranscriptionServiceFactory;
  private services: Map<string, ITranscriptionService> = new Map();

  private constructor() {
    // Initialize services
    this.services.set('whisper', new WhisperCppTranscriptionService());
  }

  public static getInstance(): TranscriptionServiceFactory {
    if (!TranscriptionServiceFactory.instance) {
      TranscriptionServiceFactory.instance = new TranscriptionServiceFactory();
    }
    return TranscriptionServiceFactory.instance;
  }

  public getService(serviceType: string = 'openai'): ITranscriptionService {
    const serviceTypeLower = serviceType.toLowerCase();
    
    // Handle auto-fallback service type
    if (serviceTypeLower === 'auto') {
      return new AutoFallbackTranscriptionService();
    }
    
    if (serviceTypeLower === 'openai') {
      // Always create OpenAI service with the latest API key from env
      const apiKey = process.env.OPENAI_API_KEY || '';
      if (!apiKey) {
        console.warn('[STT Factory] OPENAI_API_KEY is missing. Falling back to WhisperCpp.');
        return this.services.get('whisper')!;
      }
      const openai = new OpenAI({ apiKey });
      return new AudioTranscriptionService(openai);
    }
    
    const service = this.services.get(serviceTypeLower);
    if (!service) {
      console.warn(`STT service '${serviceType}' not found, falling back to openai`);
      return this.getService('openai');
    }
    return service;
  }
}

// Export factory instance
export const transcriptionFactory = TranscriptionServiceFactory.getInstance();

// Export convenience function for backward compatibility
export const getTranscriptionService = (serviceType?: string): ITranscriptionService => {
  // Get transcription service type from environment or default to 'openai'
  const type = serviceType || process.env.TRANSCRIPTION_SERVICE_TYPE || 'openai';
  return transcriptionFactory.getService(type);
};
