import { OpenAI } from 'openai';
import { OpenAITranscriptionService } from './OpenAITranscriptionService.js';
import { ElevenLabsSTTService } from './ElevenLabsSTTService.js';
import { AutoFallbackSTTService } from './AutoFallbackSTTService.js';
// Import WhisperCpp service lazily to avoid working directory corruption during startup
import { AudioFileHandler } from '../handlers/AudioFileHandler.js';

export interface ITranscriptionService {
  transcribe(audioBuffer: Buffer, options?: { language?: string }): Promise<string>;
}

/**
 * Factory for creating transcription services with 3-tier auto-fallback support
 */
export class TranscriptionServiceFactory {
  private static instance: TranscriptionServiceFactory;
  private services: Map<string, ITranscriptionService> = new Map();

  private constructor() {
    // Services are lazy-loaded to avoid import-time issues
  }

  public static getInstance(): TranscriptionServiceFactory {
    if (!TranscriptionServiceFactory.instance) {
      TranscriptionServiceFactory.instance = new TranscriptionServiceFactory();
    }
    return TranscriptionServiceFactory.instance;
  }

  public getService(serviceType: string = 'auto'): ITranscriptionService {
    const serviceTypeLower = serviceType.toLowerCase();
    
    // Handle 3-tier auto-fallback service type (default)
    if (serviceTypeLower === 'auto') {
      if (!this.services.has('auto')) {
        console.log('[STT Factory] Creating 3-tier auto-fallback STT service: OpenAI → ElevenLabs → Whisper.cpp');
        this.services.set('auto', new AutoFallbackSTTService());
        console.log('[STT Factory] Created and cached auto service');
      }
      return this.services.get('auto')!;
    }
    
    if (serviceTypeLower === 'openai') {
      // Always create OpenAI service with the latest API key from env
      const apiKey = process.env.OPENAI_API_KEY || '';
      if (!apiKey) {
        console.warn('[STT Factory] OPENAI_API_KEY is missing. Falling back to auto (3-tier fallback).');
        return this.getService('auto');
      }
      const openai = new OpenAI({ apiKey });
      return new OpenAITranscriptionService(openai);
    }
    
    if (serviceTypeLower === 'elevenlabs') {
      const apiKey = process.env.ELEVENLABS_API_KEY || '';
      if (!apiKey) {
        console.warn('[STT Factory] ELEVENLABS_API_KEY is missing. Falling back to auto (3-tier fallback).');
        return this.getService('auto');
      }
      return new ElevenLabsSTTService(apiKey);
    }
    
    if (serviceTypeLower === 'whisper') {
      // For direct whisper requests, we'll need to load it asynchronously
      console.warn('[STT Factory] Direct whisper service requested - loading...');
      return this.createWhisperService();
    }
    
    console.warn(`STT service '${serviceType}' not found, falling back to auto (3-tier fallback)`);
    return this.getService('auto');
  }

  private createWhisperService(): ITranscriptionService {
    // Create a service that lazy-loads Whisper.cpp
    return {
      async transcribe(audioBuffer: Buffer, options?: { language?: string }): Promise<string> {
        const originalCwd = process.cwd();
        
        try {
          // Dynamically import WhisperCpp service
          const { WhisperCppTranscriptionService } = await import('./WhisperCppTranscriptionService.js');
          const whisperService = new WhisperCppTranscriptionService();
          return await whisperService.transcribe(audioBuffer, options);
        } finally {
          // Restore working directory if it was changed
          if (process.cwd() !== originalCwd) {
            console.warn('[STT Factory] Restoring working directory from', process.cwd(), 'to', originalCwd);
            process.chdir(originalCwd);
          }
        }
      }
    };
  }
}

// Export factory instance
export const transcriptionFactory = TranscriptionServiceFactory.getInstance();

// Export convenience function for backward compatibility
export const getTranscriptionService = (serviceType?: string): ITranscriptionService => {
  // Get transcription service type from environment or default to 'auto' (3-tier fallback)
  const type = serviceType || process.env.STT_SERVICE_TYPE || 'auto';
  return transcriptionFactory.getService(type);
};
