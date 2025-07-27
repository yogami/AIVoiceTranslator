/**
 * Translation Service Factory
 * 
 * Factory pattern implementation for creating translation services with auto-fallback capability.
 * Supports OpenAI Translation API as primary service and MyMemory API as free fallback.
 * 
 * Design Patterns Used:
 * - Factory Pattern: Creates appropriate translation service instances
 * - Strategy Pattern: Allows switching between different translation strategies
 * - Circuit Breaker Pattern: Prevents repeated calls to failing services
 */

import { OpenAI } from 'openai';
import { ITranslationService, OpenAITranslationService } from '../TranslationService.js';
import { MyMemoryTranslationService } from './MyMemoryTranslationService.js';

/**
 * Comprehensive Auto-Fallback Translation Service
 * Automatically falls back to MyMemory when OpenAI fails for any reason
 */
export class AutoFallbackTranslationService implements ITranslationService {
  private openaiService: ITranslationService | null = null;
  private myMemoryService: ITranslationService | null = null;
  private isOpenAIDown: boolean = false;
  private lastFailTime: number = 0;
  private failureCount: number = 0;
  private readonly RETRY_COOLDOWN_MS = 300000; // 5 minutes before retrying OpenAI

  constructor() {
    // Initialize OpenAI service if API key is available
    this.initializeOpenAI();
    
    // Initialize MyMemory service (always available - no API key required)
    this.myMemoryService = new MyMemoryTranslationService();
  }

  private initializeOpenAI(): void {
    const apiKey = process.env.OPENAI_API_KEY || '';
    if (apiKey) {
      try {
        const openai = new OpenAI({ apiKey });
        this.openaiService = new OpenAITranslationService(openai);
        console.log('[AutoFallback Translation] OpenAI service initialized');
      } catch (error) {
        console.warn('[AutoFallback Translation] Failed to initialize OpenAI service:', error);
        this.openaiService = null;
      }
    } else {
      console.log('[AutoFallback Translation] OpenAI API key not found, using MyMemory only');
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
      console.log(`[AutoFallback Translation] OpenAI API error detected - Status Code: ${errorCode}`);
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
      console.log(`[AutoFallback Translation] OpenAI API error detected - Pattern: "${matchedPattern}"`);
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
      console.log(`[AutoFallback Translation] OpenAI marked as down. Failure #${this.failureCount}. Next retry in ${cooldownMinutes} minutes.`);
    }
  }

  private markOpenAIRecovery(): void {
    if (this.isOpenAIDown) {
      console.log(`[AutoFallback Translation] OpenAI service recovered after ${this.failureCount} failures!`);
      this.isOpenAIDown = false;
      this.failureCount = 0; // Reset failure count on successful recovery
    }
  }

  public async translate(
    text: string,
    sourceLanguage: string,
    targetLanguage: string
  ): Promise<string> {
    // If OpenAI is available and not in cooldown, try it first
    if (this.openaiService && this.shouldRetryOpenAI()) {
      try {
        const result = await this.openaiService.translate(text, sourceLanguage, targetLanguage);
        
        // Success! Reset failure state
        this.markOpenAIRecovery();
        return result;
        
      } catch (error) {
        console.warn('[AutoFallback Translation] OpenAI translation failed:', error instanceof Error ? error.message : error);
        
        // Check if it's any OpenAI failure that should trigger fallback
        if (this.isOpenAIFailureError(error)) {
          this.markOpenAIFailure(error);
        } else {
          // For non-API errors, still fallback for this request
          console.log('[AutoFallback Translation] Non-API error, falling back for this request only');
        }
        
        // Fall through to MyMemory fallback
      }
    }

    // Use MyMemory as fallback
    const reason = this.isOpenAIDown 
      ? `OpenAI in cooldown (${this.failureCount} failures)`
      : 'OpenAI unavailable';
    
    console.log(`[AutoFallback Translation] Using MyMemory (${reason})`);
    
    if (!this.myMemoryService) {
      throw new Error('Both OpenAI and MyMemory translation services are unavailable');
    }
    
    return await this.myMemoryService.translate(text, sourceLanguage, targetLanguage);
  }
}

/**
 * Factory for creating translation services
 */
export class TranslationServiceFactory {
  private static instance: TranslationServiceFactory;
  private services: Map<string, ITranslationService> = new Map();

  private constructor() {
    // Services are lazy-loaded to avoid import-time issues
  }

  public static getInstance(): TranslationServiceFactory {
    if (!TranslationServiceFactory.instance) {
      TranslationServiceFactory.instance = new TranslationServiceFactory();
    }
    return TranslationServiceFactory.instance;
  }

  public getService(serviceType: string = 'openai'): ITranslationService {
    const serviceTypeLower = serviceType.toLowerCase();
    
    // Check if we already have this service cached
    if (this.services.has(serviceTypeLower)) {
      return this.services.get(serviceTypeLower)!;
    }
    
    let service: ITranslationService;
    
    // Handle auto-fallback service type
    if (serviceTypeLower === 'auto') {
      service = new AutoFallbackTranslationService();
    } else if (serviceTypeLower === 'openai') {
      // Always create OpenAI service with the latest API key from env
      const apiKey = process.env.OPENAI_API_KEY || '';
      if (!apiKey) {
        console.warn('[Translation Factory] OPENAI_API_KEY is missing. Falling back to auto (which includes MyMemory).');
        service = new AutoFallbackTranslationService();
      } else {
        const openai = new OpenAI({ apiKey });
        service = new OpenAITranslationService(openai);
      }
    } else if (serviceTypeLower === 'mymemory') {
      service = new MyMemoryTranslationService();
    } else {
      console.warn(`Translation service '${serviceType}' not found, falling back to auto`);
      service = new AutoFallbackTranslationService();
    }
    
    // Cache the service for future use
    this.services.set(serviceTypeLower, service);
    return service;
  }
  
  /**
   * Clear service cache (useful for testing)
   */
  public clearCache(): void {
    this.services.clear();
  }
}

// Export factory instance
export const translationFactory = TranslationServiceFactory.getInstance();

// Export convenience function for backward compatibility
export const getTranslationService = (serviceType?: string): ITranslationService => {
  // Get translation service type from environment or default to 'openai'
  const type = serviceType || process.env.TRANSLATION_SERVICE_TYPE || 'openai';
  return translationFactory.getService(type);
};
