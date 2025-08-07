/**
 * 3-Tier Auto-Fallback STT Service (COST-OPTIMIZED)
 * 
 * Implements automatic fallback across three speech-to-text services:
 * 1. Whisper.cpp (primary) - FREE local model processing
 * 2. OpenAI STT (secondary) - PAID high-quality cloud transcription
 * 3. ElevenLabs STT (final fallback) - EXPENSIVE alternative cloud transcription
 * 
 * Features circuit breaker pattern with exponential backoff for robust error handling.
 * Prioritizes free services to minimize API costs.
 */

import { ISTTTranscriptionService } from '../../../services/translation/translation.interfaces';
import { OpenAISTTTranscriptionService } from './OpenAITranscriptionService';
import { ElevenLabsSTTService } from './ElevenLabsSTTService';
import { VoiceIsolationService } from '../audio/VoiceIsolationService';

export class AutoFallbackSTTService implements ISTTTranscriptionService {
  private primaryService: ISTTTranscriptionService | null = null;
  private secondaryService: ISTTTranscriptionService | null = null;
  private finalFallbackService: ISTTTranscriptionService | null = null;
  private voiceIsolationService: VoiceIsolationService | null = null;
  
  // Circuit breaker state for primary service (OpenAI)
  private isPrimaryDown: boolean = false;
  private primaryLastFailTime: number = 0;
  private primaryFailureCount: number = 0;
  
  // Circuit breaker state for secondary service (ElevenLabs)
  private isSecondaryDown: boolean = false;
  private secondaryLastFailTime: number = 0;
  private secondaryFailureCount: number = 0;
  
  private readonly RETRY_COOLDOWN_BASE_MS = 300000; // 5 minutes base
  private readonly MAX_COOLDOWN_MS = 1500000; // 25 minutes max

  constructor() {
    this.initializeServices();
  }

  private async initializeServices(): Promise<void> {
    try {
      // REORDERED: FREE SERVICES FIRST
      // Initialize primary service (Whisper.cpp - FREE)
      try {
        const { WhisperCppSTTTranscriptionService } = await import('./WhisperCppTranscriptionService');
        this.primaryService = new WhisperCppSTTTranscriptionService();
        console.log('[AutoFallback STT] Primary service (Whisper.cpp FREE) initialized');
      } catch (error) {
        console.warn('[AutoFallback STT] Failed to initialize Whisper.cpp service:', error);
      }

      // Initialize secondary service (OpenAI - PAID)
      const openaiApiKey = process.env.OPENAI_API_KEY;
      if (openaiApiKey) {
        try {
          const { OpenAI } = await import('openai');
          const openai = new OpenAI({ apiKey: openaiApiKey });
          this.secondaryService = new OpenAISTTTranscriptionService(openai);
          console.log('[AutoFallback STT] Secondary service (OpenAI PAID) initialized');
        } catch (error) {
          console.warn('[AutoFallback STT] Failed to initialize OpenAI service:', error);
        }
      }

      // Initialize final fallback service (ElevenLabs - EXPENSIVE) - lazy loaded
      const elevenLabsApiKey = process.env.ELEVENLABS_API_KEY;
      if (elevenLabsApiKey) {
        console.log('[AutoFallback STT] Final fallback service (ElevenLabs EXPENSIVE) will be loaded when needed');
        
        // Initialize voice isolation service if ElevenLabs API key is available
        try {
          this.voiceIsolationService = new VoiceIsolationService();
          console.log('[AutoFallback STT] Voice isolation service initialized for enhanced accuracy');
        } catch (error) {
          console.warn('[AutoFallback STT] Voice isolation service unavailable:', error);
        }
      }

      console.log('[AutoFallback STT] 3-tier service initialized: Whisper.cpp (FREE) → OpenAI (PAID) → ElevenLabs (EXPENSIVE)');
    } catch (error) {
      console.error('[AutoFallback STT] Error during service initialization:', error);
    }
  }

  private async getFinalFallbackService(): Promise<ISTTTranscriptionService> {
    if (!this.finalFallbackService) {
      const elevenLabsApiKey = process.env.ELEVENLABS_API_KEY;
      if (elevenLabsApiKey) {
        this.finalFallbackService = new ElevenLabsSTTService(elevenLabsApiKey);
        console.log('[AutoFallback STT] Final fallback service (ElevenLabs EXPENSIVE) loaded');
      } else {
        // If no ElevenLabs key, fallback to Whisper.cpp again
        const { WhisperCppSTTTranscriptionService } = await import('./WhisperCppTranscriptionService');
        this.finalFallbackService = new WhisperCppSTTTranscriptionService();
        console.log('[AutoFallback STT] Final fallback service (Whisper.cpp backup) loaded');
      }
    }
    // TypeScript: this.finalFallbackService is guaranteed to be set here
    return this.finalFallbackService!;
  }

  async transcribe(audioBuffer: Buffer, sourceLanguage: string): Promise<string> {
    if (!audioBuffer || audioBuffer.length === 0) {
      throw new Error('Audio buffer is required and cannot be empty');
    }
    const language = sourceLanguage || 'en';
    // Apply voice isolation to improve STT accuracy across all services
    // Voice isolation will only be applied for Whisper.cpp fallback
    // Try primary service (OpenAI)
    if (this.shouldTryPrimary()) {
      try {
        console.log('[AutoFallback STT] Attempting primary service (OpenAI STT)');
        const result = await this.primaryService!.transcribe(audioBuffer, language);
        // Reset failure count on success
        if (this.primaryFailureCount > 0) {
          console.log('[AutoFallback STT] Primary service recovered after', this.primaryFailureCount, 'failures');
          this.primaryFailureCount = 0;
          this.isPrimaryDown = false;
        }
        console.log('[AutoFallback STT] Primary service succeeded');
        return result;
      } catch (error) {
        console.error('[AutoFallback STT] Primary service failed:', error instanceof Error ? error.message : error);
        // Handle circuit breaker logic
        if (this.isPrimaryAPIError(error)) {
          this.handlePrimaryFailure();
        }
      }
    }
    // Try secondary service (ElevenLabs)
    if (this.shouldTrySecondary()) {
      try {
        console.log('[AutoFallback STT] Attempting secondary service (ElevenLabs STT)');
        const result = await this.secondaryService!.transcribe(audioBuffer, language);
        // Reset failure count on success
        if (this.secondaryFailureCount > 0) {
          console.log('[AutoFallback STT] Secondary service recovered after', this.secondaryFailureCount, 'failures');
          this.secondaryFailureCount = 0;
          this.isSecondaryDown = false;
        }
        console.log('[AutoFallback STT] Secondary service succeeded');
        return result;
      } catch (error) {
        console.error('[AutoFallback STT] Secondary service failed:', error instanceof Error ? error.message : error);
        // Handle circuit breaker logic
        if (this.isSecondaryAPIError(error)) {
          this.handleSecondaryFailure();
        }
      }
    }
    // Use final fallback service (Whisper.cpp) with voice isolation
    try {
      console.log('[AutoFallback STT] Using final fallback service (Whisper.cpp)');
      let processedAudioBuffer = audioBuffer;
      if (this.voiceIsolationService?.isAvailable()) {
        try {
          console.log('[AutoFallback STT] Applying voice isolation for enhanced accuracy');
          processedAudioBuffer = await this.voiceIsolationService.isolateVoice(audioBuffer, {
            removeBackgroundNoise: true,
            isolatePrimarySpeaker: true,
            enhancementStrength: 0.8
          });
          const qualityAnalysis = await this.voiceIsolationService.analyzeAudioQuality(audioBuffer, processedAudioBuffer);
          console.log('[AutoFallback STT] Voice isolation applied:', 
            `${Math.round(qualityAnalysis.estimatedNoiseReduction * 100)}% noise reduction,`,
            `${Math.round(qualityAnalysis.compressionRatio * 100)}% size ratio`);
        } catch (error) {
          console.warn('[AutoFallback STT] Voice isolation failed, using original audio:', error instanceof Error ? error.message : error);
          processedAudioBuffer = audioBuffer; // Fallback to original audio
        }
      }
      const finalService = await this.getFinalFallbackService();
      const result = await finalService.transcribe(processedAudioBuffer, language);
      console.log('[AutoFallback STT] Final fallback service succeeded');
      return result;
    } catch (error) {
      console.error('[AutoFallback STT] Final fallback service failed:', error instanceof Error ? error.message : error);
      throw new Error(`All STT services failed. Last error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private shouldTryPrimary(): boolean {
    if (!this.primaryService) return false;
    if (!this.isPrimaryDown) return true;
    
    const cooldownMs = this.calculateCooldown(this.primaryFailureCount);
    const timeSinceLastFail = Date.now() - this.primaryLastFailTime;
    
    if (timeSinceLastFail >= cooldownMs) {
      console.log('[AutoFallback STT] Primary service cooldown expired, retrying');
      this.isPrimaryDown = false;
      return true;
    }
    
    return false;
  }

  private shouldTrySecondary(): boolean {
    if (!this.secondaryService) return false;
    if (!this.isSecondaryDown) return true;
    
    const cooldownMs = this.calculateCooldown(this.secondaryFailureCount);
    const timeSinceLastFail = Date.now() - this.secondaryLastFailTime;
    
    if (timeSinceLastFail >= cooldownMs) {
      console.log('[AutoFallback STT] Secondary service cooldown expired, retrying');
      this.isSecondaryDown = false;
      return true;
    }
    
    return false;
  }

  private handlePrimaryFailure(): void {
    this.primaryFailureCount++;
    this.primaryLastFailTime = Date.now();
    this.isPrimaryDown = true;
    
    const cooldownMinutes = Math.round(this.calculateCooldown(this.primaryFailureCount) / 60000);
    console.log(`[AutoFallback STT] Primary service marked as down. Failure #${this.primaryFailureCount}. Next retry in ${cooldownMinutes} minutes.`);
  }

  private handleSecondaryFailure(): void {
    this.secondaryFailureCount++;
    this.secondaryLastFailTime = Date.now();
    this.isSecondaryDown = true;
    
    const cooldownMinutes = Math.round(this.calculateCooldown(this.secondaryFailureCount) / 60000);
    console.log(`[AutoFallback STT] Secondary service marked as down. Failure #${this.secondaryFailureCount}. Next retry in ${cooldownMinutes} minutes.`);
  }

  private calculateCooldown(failureCount: number): number {
    const exponentialBackoff = Math.min(
      this.RETRY_COOLDOWN_BASE_MS * Math.pow(2, failureCount - 1),
      this.MAX_COOLDOWN_MS
    );
    return exponentialBackoff;
  }

  private isPrimaryAPIError(error: any): boolean {
    if (!error) return false;
    
    const errorMessage = error.message?.toLowerCase() || '';
    const errorStatus = error.status || error.code;
    
    // OpenAI API error patterns
    const fallbackStatusCodes = [401, 402, 403, 429, 500, 502, 503, 504];
    const fallbackErrorPatterns = [
      'api key',
      'unauthorized', 
      'quota',
      'rate limit',
      'billing',
      'server error'
    ];
    
    return fallbackStatusCodes.includes(errorStatus) || 
           fallbackErrorPatterns.some(pattern => errorMessage.includes(pattern));
  }

  private isSecondaryAPIError(error: any): boolean {
    if (!error) return false;
    
    const errorMessage = error.message?.toLowerCase() || '';
    const errorStatus = error.status || error.code;
    
    // ElevenLabs API error patterns
    const fallbackStatusCodes = [401, 402, 403, 429, 500, 502, 503, 504];
    const fallbackErrorPatterns = [
      'invalid api key',
      'unauthorized',
      'quota exceeded', 
      'rate limit',
      'billing',
      'server error'
    ];
    
    return fallbackStatusCodes.includes(errorStatus) || 
           fallbackErrorPatterns.some(pattern => errorMessage.includes(pattern));
  }
}
