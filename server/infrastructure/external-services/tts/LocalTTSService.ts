/**
 * Local TTS Service using text2wav (eSpeak-NG compiled to WebAssembly)
 * High-quality FREE local alternative to Browser TTS
 * Supports 100+ languages and accents out-of-the-box
 */

import { ITTSService, TTSResult } from '../../../services/tts/TTSService';

export class LocalTTSService implements ITTSService {
  private isInitialized = false;
  private text2wav: any;
  private supportedLanguages: Set<string> = new Set();

  constructor() {
    this.initialize();
  }

  private async initialize(): Promise<void> {
    try {
      // Lazy load text2wav to avoid issues during module initialization
      // Use dynamic import for ESM compatibility
      const text2wavModule = await import('text2wav');
      this.text2wav = text2wavModule.default || text2wavModule;
      this.isInitialized = true;
      
      // Common languages supported by eSpeak-NG
      this.supportedLanguages = new Set([
        'en-US', 'en-GB', 'en-AU', 'en-CA', 'en-IN', 'en-ZA',
        'es-ES', 'es-MX', 'es-AR', 'es-CO', 'es-US',
        'fr-FR', 'fr-CA', 'fr-BE', 'fr-CH',
        'de-DE', 'de-AT', 'de-CH',
        'it-IT', 'pt-PT', 'pt-BR',
        'ru-RU', 'zh-CN', 'zh-TW', 'zh-HK',
        'ja-JP', 'ko-KR', 'ar-SA', 'hi-IN',
        'nl-NL', 'sv-SE', 'da-DK', 'no-NO',
        'fi-FI', 'pl-PL', 'cs-CZ', 'hu-HU',
        'tr-TR', 'th-TH', 'vi-VN', 'id-ID'
      ]);
      
      console.log('[Local TTS] Service initialized with eSpeak-NG, supporting', this.supportedLanguages.size, 'languages');
    } catch (error) {
      console.error('[Local TTS] Failed to initialize:', error);
      this.isInitialized = false;
    }
  }

  async synthesize(text: string, options: { language?: string; voice?: string } = {}): Promise<TTSResult> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (!this.isInitialized) {
      return {
        audioBuffer: Buffer.alloc(0),
        error: 'Local TTS service not initialized',
        ttsServiceType: 'local'
      };
    }

    try {
      const language = options.language || 'en-US';
      
      // Map common language codes to eSpeak-NG voice names
      const voiceMap: { [key: string]: string } = {
        'en-US': 'en',
        'en-GB': 'en-gb',
        'en-AU': 'en-au',
        'en-CA': 'en-ca',
        'es-ES': 'es',
        'es-MX': 'es-mx',
        'fr-FR': 'fr',
        'de-DE': 'de',
        'it-IT': 'it',
        'pt-PT': 'pt',
        'pt-BR': 'pt-br',
        'ru-RU': 'ru',
        'zh-CN': 'zh',
        'zh-TW': 'zh-tw',
        'ja-JP': 'ja',
        'ko-KR': 'ko',
        'ar-SA': 'ar',
        'hi-IN': 'hi',
        'nl-NL': 'nl',
        'sv-SE': 'sv',
        'da-DK': 'da',
        'no-NO': 'no',
        'fi-FI': 'fi',
        'pl-PL': 'pl',
        'cs-CZ': 'cs',
        'hu-HU': 'hu',
        'tr-TR': 'tr',
        'th-TH': 'th',
        'vi-VN': 'vi'
      };

      const voice = voiceMap[language] || 'en'; // fallback to English
      
      console.log(`[Local TTS] Synthesizing "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}" using voice: ${voice}`);
      
      // Generate audio using text2wav
      const audioData = await this.text2wav(text, {
        voice: voice,
        speed: 175,      // 175 words per minute (default)
        pitch: 50,       // neutral pitch
        amplitude: 100   // full volume
      });

      // audioData is Uint8Array, convert to Buffer
      const audioBuffer = Buffer.from(audioData);
      
      console.log(`[Local TTS] Successfully generated ${audioBuffer.length} bytes of WAV audio`);

      return {
        audioBuffer,
        ttsServiceType: 'local'
      };

    } catch (error) {
      console.error('[Local TTS] Synthesis failed:', error);
      return {
        audioBuffer: Buffer.alloc(0),
        error: error instanceof Error ? error.message : 'Unknown synthesis error',
        ttsServiceType: 'local'
      };
    }
  }

  // Test method to verify the service works
  async testSynthesis(): Promise<boolean> {
    try {
      const result = await this.synthesize('Hello world', { language: 'en-US' });
      return result.audioBuffer.length > 0 && !result.error;
    } catch (error) {
      console.error('[Local TTS] Test synthesis failed:', error);
      return false;
    }
  }
} 