/**
 * Main TTS Service Interface
 * Provides a unified interface for all TTS services with auto-fallback support
 */

import { TTSServiceFactory } from './TTSServiceFactory.js';
import { ITTSService } from './ElevenLabsTTSService.js';

export class TTSService {
  private service: ITTSService;
  private serviceType: string;

  constructor(serviceType: string = process.env.TTS_SERVICE_TYPE || 'auto') {
    this.serviceType = serviceType;
    this.service = TTSServiceFactory.createTTSService(serviceType);
    console.log(`[TTSService] Initialized with type: ${serviceType}`);
  }

  public async synthesize(text: string, options: { language?: string; voice?: string } = {}): Promise<{ audioBuffer?: Buffer; audioUrl?: string; error?: string }> {
    try {
      return await this.service.synthesize(text, options);
    } catch (error) {
      console.error('[TTSService] Synthesis failed:', error);
      throw error;
    }
  }

  public getServiceType(): string {
    return this.serviceType;
  }

  public getService(): ITTSService {
    return this.service;
  }
}

export type { ITTSService };
export { TTSServiceFactory, getTTSService } from './TTSServiceFactory.js';
export { ElevenLabsTTSService } from './ElevenLabsTTSService.js';
export { BrowserTTSService } from './BrowserTTSService.js';
export { OpenAITTSService } from './OpenAITTSService.js';
export { AutoFallbackTTSService } from './TTSServiceFactory.js';
