

// Unified TTS result type
export type TTSResult = {
  audioBuffer: Buffer;
  audioUrl?: string;
  error?: string | { name: string; message: string };
  ttsServiceType: string;
  // Client-side synthesis properties (for browser TTS)
  clientSideText?: string;
  clientSideLanguage?: string;
};

// Main TTS Service Interface
export interface ITTSService {
  synthesize(
    text: string,
    options?: {
      language?: string;
      voice?: string;
      speed?: number;
      preserveEmotions?: boolean;
      emotionContext?: any;
    }
  ): Promise<TTSResult>;
}

import { TTSServiceFactory } from '../../infrastructure/factories/TTSServiceFactory';

export class TTSService {
  private service: ITTSService;
  private serviceType: string;

  constructor(serviceType: string = process.env.TTS_SERVICE_TYPE || 'auto') {
    this.serviceType = serviceType;
    this.service = TTSServiceFactory.createTTSService(serviceType);
    console.log(`[TTSService] Initialized with type: ${serviceType}`);
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
    try {
      return await this.service.synthesize(text, options);
    } catch (error) {
      console.error('[TTSService] Synthesis failed:', error);
      return { audioBuffer: Buffer.alloc(0), error: error instanceof Error ? error.message : String(error), ttsServiceType: this.serviceType };
    }
  }

  public getServiceType(): string {
    return this.serviceType;
  }

  public getService(): ITTSService {
    return this.service;
  }
}

export { TTSServiceFactory, getTTSService } from '../../infrastructure/factories/TTSServiceFactory';
export { ElevenLabsTTSService } from '../../infrastructure/external-services/tts/ElevenLabsTTSService';
export { BrowserTTSService } from '../../infrastructure/external-services/tts/BrowserTTSService';
export { OpenAITTSService } from '../../infrastructure/external-services/tts/OpenAITTSService';
