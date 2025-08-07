/**
 * Speech Pipeline Orchestrator - Thin Orchestration Layer
 * 
 * Implements SOLID principles as a lightweight coordinator:
 * - Single Responsibility: Orchestrates speech processing pipeline only
 * - Open/Closed: Extensible without modification via factory pattern
 * - Liskov Substitution: All services implement consistent interfaces
 * - Interface Segregation: Focused interfaces for each service type
 * - Dependency Inversion: Depends on abstractions, not concrete implementations
 * 
 * Coordinates the 4-tier fallback architecture across all services:
 * STT: Premium → High-Quality Free → Enhanced Free → Basic Free
 * Translation: Premium → High-Quality Free → Basic Free → Offline  
 * TTS: Premium → High-Quality Free → Basic Free → Silent
 */

import { getSTTTranscriptionService } from './stttranscription/TranscriptionServiceFactory';
import { getTranslationService } from './translation/TranslationServiceFactory';
import { getTTSService } from './tts/TTSServiceFactory';
import type { ISTTTranscriptionService } from './translation/translation.interfaces';
import type { ITranslationService } from './translation/translation.interfaces';
import type { ITTSService, TTSResult } from './tts/TTSService';

// Pipeline configuration interface
interface PipelineConfig {
  sttTier?: string;
  translationTier?: string;
  ttsTier?: string;
  enableVoiceIsolation?: boolean;
  enableQualityOptimization?: boolean;
}

// Pipeline result interface
interface PipelineResult {
  transcription: string;
  translation: string;
  audioResult: TTSResult;
  metrics: {
    sttTime: number;
    translationTime: number;
    ttsTime: number;
    totalTime: number;
    servicesUsed: {
      stt: string;
      translation: string;
      tts: string;
    };
  };
}

export class SpeechPipelineOrchestrator {
  private sttService: ISTTTranscriptionService;
  private translationService: ITranslationService;
  private ttsService: ITTSService;
  private config: PipelineConfig;

  constructor(config: PipelineConfig = {}) {
    this.config = {
      enableVoiceIsolation: true,
      enableQualityOptimization: true,
      ...config
    };
    
    // Initialize services using factory pattern
    this.sttService = getSTTTranscriptionService(config.sttTier);
    this.translationService = getTranslationService(config.translationTier);
    this.ttsService = getTTSService(config.ttsTier);
    
    console.log('[SpeechPipelineOrchestrator] Initialized with 4-tier fallback architecture');
  }

  /**
   * Process complete speech pipeline: Audio → Text → Translation → Audio
   */
  async processAudioPipeline(
    audioBuffer: Buffer,
    sourceLanguage: string,
    targetLanguage: string,
    ttsOptions: { voice?: string } = {}
  ): Promise<PipelineResult> {
    const startTime = performance.now();
    const metrics = {
      sttTime: 0,
      translationTime: 0,
      ttsTime: 0,
      totalTime: 0,
      servicesUsed: {
        stt: 'unknown',
        translation: 'unknown',
        tts: 'unknown'
      }
    };

    try {
      console.log('[SpeechPipelineOrchestrator] Starting pipeline:', { sourceLanguage, targetLanguage });

      // Step 1: Speech-to-Text
      const sttStart = performance.now();
      const transcription = await this.sttService.transcribe(audioBuffer, sourceLanguage);
      const sttEnd = performance.now();
      metrics.sttTime = sttEnd - sttStart;
      metrics.servicesUsed.stt = this.getServiceName(this.sttService);
      
      console.log('[SpeechPipelineOrchestrator] STT completed:', transcription.substring(0, 100));

      // Step 2: Translation
      const translationStart = performance.now();
      const translation = await this.translationService.translate(transcription, sourceLanguage, targetLanguage);
      const translationEnd = performance.now();
      metrics.translationTime = translationEnd - translationStart;
      metrics.servicesUsed.translation = this.getServiceName(this.translationService);
      
      console.log('[SpeechPipelineOrchestrator] Translation completed:', translation.substring(0, 100));

      // Step 3: Text-to-Speech
      const ttsStart = performance.now();
      const audioResult = await this.ttsService.synthesize(translation, {
        language: targetLanguage,
        voice: ttsOptions.voice
      });
      const ttsEnd = performance.now();
      metrics.ttsTime = ttsEnd - ttsStart;
      metrics.servicesUsed.tts = this.getServiceName(this.ttsService);

      const endTime = performance.now();
      metrics.totalTime = endTime - startTime;

      console.log('[SpeechPipelineOrchestrator] Pipeline completed successfully:', {
        ...metrics,
        audioSize: audioResult.audioBuffer.length
      });

      return {
        transcription,
        translation,
        audioResult,
        metrics
      };

    } catch (error) {
      const endTime = performance.now();
      metrics.totalTime = endTime - startTime;
      
      console.error('[SpeechPipelineOrchestrator] Pipeline failed:', error);
      throw new Error(`Speech pipeline failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Process STT only
   */
  async transcribeAudio(audioBuffer: Buffer, sourceLanguage: string): Promise<string> {
    console.log('[SpeechPipelineOrchestrator] Transcribing audio only');
    return await this.sttService.transcribe(audioBuffer, sourceLanguage);
  }

  /**
   * Process Translation only
   */
  async translateText(text: string, sourceLanguage: string, targetLanguage: string): Promise<string> {
    console.log('[SpeechPipelineOrchestrator] Translating text only');
    return await this.translationService.translate(text, sourceLanguage, targetLanguage);
  }

  /**
   * Process TTS only
   */
  async synthesizeSpeech(text: string, language: string, options: { voice?: string } = {}): Promise<TTSResult> {
    console.log('[SpeechPipelineOrchestrator] Synthesizing speech only');
    return await this.ttsService.synthesize(text, { language, voice: options.voice });
  }

  /**
   * Update pipeline configuration
   */
  updateConfig(newConfig: Partial<PipelineConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    // Reinitialize services if tiers changed
    if (newConfig.sttTier) {
      this.sttService = getSTTTranscriptionService(newConfig.sttTier);
    }
    if (newConfig.translationTier) {
      this.translationService = getTranslationService(newConfig.translationTier);
    }
    if (newConfig.ttsTier) {
      this.ttsService = getTTSService(newConfig.ttsTier);
    }
    
    console.log('[SpeechPipelineOrchestrator] Configuration updated:', this.config);
  }

  /**
   * Get current service information
   */
  getServiceInfo(): {
    stt: string;
    translation: string;
    tts: string;
    config: PipelineConfig;
  } {
    return {
      stt: this.getServiceName(this.sttService),
      translation: this.getServiceName(this.translationService),
      tts: this.getServiceName(this.ttsService),
      config: this.config
    };
  }

  /**
   * Health check for all services
   */
  async healthCheck(): Promise<{
    stt: boolean;
    translation: boolean;
    tts: boolean;
    overall: boolean;
  }> {
    const results = {
      stt: false,
      translation: false,
      tts: false,
      overall: false
    };

    try {
      // Test STT with small audio buffer
      const testBuffer = Buffer.alloc(1024);
      await this.sttService.transcribe(testBuffer, 'en-US');
      results.stt = true;
    } catch (error) {
      console.warn('[SpeechPipelineOrchestrator] STT health check failed:', error instanceof Error ? error.message : error);
    }

    try {
      // Test Translation
      await this.translationService.translate('Hello', 'en', 'es');
      results.translation = true;
    } catch (error) {
      console.warn('[SpeechPipelineOrchestrator] Translation health check failed:', error instanceof Error ? error.message : error);
    }

    try {
      // Test TTS
      await this.ttsService.synthesize('Hello', { language: 'en-US' });
      results.tts = true;
    } catch (error) {
      console.warn('[SpeechPipelineOrchestrator] TTS health check failed:', error instanceof Error ? error.message : error);
    }

    results.overall = results.stt && results.translation && results.tts;
    return results;
  }

  private getServiceName(service: any): string {
    if (!service) return 'unknown';
    
    // Extract service name from constructor or class name
    const className = service.constructor?.name || 'unknown';
    
    // Map known class names to friendly names
    const serviceNames: { [key: string]: string } = {
      'OpenAISTTTranscriptionService': 'OpenAI STT',
      'ElevenLabsSTTService': 'ElevenLabs STT',
      'DeepgramSTTService': 'Deepgram Nova-2',
      'WhisperCppSTTTranscriptionService': 'Whisper.cpp',
      'AutoFallbackSTTService': 'Auto-Fallback STT',
      'OpenAITranslationService': 'OpenAI Translation',
      'DeepSeekTranslationService': 'DeepSeek Translation',
      'MyMemoryTranslationService': 'MyMemory Translation',
      'AutoFallbackTranslationService': 'Auto-Fallback Translation',
      'ElevenLabsTTSService': 'ElevenLabs TTS',
      'OpenAITTSService': 'OpenAI TTS',
      'LocalTTSService': 'Local eSpeak-NG',
      'BrowserTTSService': 'Browser TTS',
      'AutoFallbackTTSService': 'Auto-Fallback TTS'
    };
    
    return serviceNames[className] || className;
  }

  /**
   * Factory method to create orchestrator with default configuration
   */
  static createWithDefaultServices(): SpeechPipelineOrchestrator {
    console.log('[SpeechPipelineOrchestrator] Creating with default 4-tier services');
    return new SpeechPipelineOrchestrator({
      sttTier: 'auto',
      translationTier: 'auto',
      ttsTier: 'auto',
      enableVoiceIsolation: true,
      enableQualityOptimization: true
    });
  }

  /**
   * Factory method to create orchestrator with free-tier configuration
   */
  static createWithFreeTierServices(): SpeechPipelineOrchestrator {
    console.log('[SpeechPipelineOrchestrator] Creating with free-tier services');
    return new SpeechPipelineOrchestrator({
      sttTier: 'whispercpp',
      translationTier: 'mymemory',
      ttsTier: 'local',
      enableVoiceIsolation: true,
      enableQualityOptimization: true
    });
  }

  /**
   * Factory method to create orchestrator with premium configuration
   */
  static createWithPremiumServices(): SpeechPipelineOrchestrator {
    console.log('[SpeechPipelineOrchestrator] Creating with premium services');
    return new SpeechPipelineOrchestrator({
      sttTier: 'openai',
      translationTier: 'openai',
      ttsTier: 'elevenlabs',
      enableVoiceIsolation: true,
      enableQualityOptimization: true
    });
  }
}
