/**
 * Browser TTS Service (Client-Side)
 * Signals to the client to use Web Speech API for text-to-speech synthesis
 * This service doesn't generate audio server-side, but tells the client to use browser TTS
 */

import { ITTSService, TTSResult } from './TTSService';

export class BrowserTTSService implements ITTSService {
  private isInitialized = false;
  private supportedLanguages: Set<string> = new Set();
  
  constructor() {
    this.initialize();
  }

  private initialize(): void {
    // Browser TTS is handled client-side using Web Speech API
    this.isInitialized = true;
    
    // Common languages supported by most browsers
    this.supportedLanguages = new Set([
      'en-US', 'en-GB', 'en-AU', 'en-CA',
      'es-ES', 'es-MX', 'es-AR', 'es-CO',
      'fr-FR', 'fr-CA', 'de-DE', 'it-IT',
      'pt-BR', 'pt-PT', 'ru-RU', 'ja-JP',
      'ko-KR', 'zh-CN', 'zh-TW', 'ar-SA',
      'hi-IN', 'nl-NL', 'sv-SE', 'da-DK',
      'no-NO', 'fi-FI', 'pl-PL', 'tr-TR'
    ]);
    
    console.log('[Browser TTS] Service initialized for client-side Web Speech API');
  }

  private getLanguageCode(language: string): string {
    // Normalize language codes
    const languageMap: Record<string, string> = {
      'en': 'en-US',
      'es': 'es-ES', 
      'fr': 'fr-FR',
      'de': 'de-DE',
      'it': 'it-IT',
      'pt': 'pt-BR',
      'ru': 'ru-RU',
      'ja': 'ja-JP',
      'ko': 'ko-KR',
      'zh': 'zh-CN',
      'ar': 'ar-SA',
      'hi': 'hi-IN',
      'nl': 'nl-NL',
      'sv': 'sv-SE',
      'da': 'da-DK',
      'no': 'no-NO',
      'fi': 'fi-FI',
      'pl': 'pl-PL',
      'tr': 'tr-TR'
    };

    return languageMap[language] || language;
  }

  public isLanguageSupported(language: string): boolean {
    const normalizedLang = this.getLanguageCode(language);
    return this.supportedLanguages.has(normalizedLang);
  }

  public async synthesize(text: string, options: { language?: string; voice?: string } = {}): Promise<TTSResult> {
    const ttsServiceType = 'browser';
    if (!this.isInitialized) {
      return {
        audioBuffer: Buffer.alloc(0),
        error: { name: 'BrowserTTSNotInitialized', message: 'Browser TTS service not initialized' },
        ttsServiceType
      };
    }

    if (!text || text.trim().length === 0) {
      return { 
        audioBuffer: Buffer.alloc(0), 
        error: { name: 'BrowserTTSEmptyText', message: 'Text cannot be empty' }, 
        ttsServiceType 
      };
    }

    const { language = 'en-US' } = options;
    const normalizedLanguage = this.getLanguageCode(language);

    try {
      console.log(`[Browser TTS] Requesting client-side synthesis for text (${text.length} chars) in language: ${normalizedLanguage}`);

      if (!this.isLanguageSupported(normalizedLanguage)) {
        console.warn(`[Browser TTS] Language ${normalizedLanguage} may not be supported by all browsers, using en-US fallback`);
      }

      // For Browser TTS, we don't generate audio server-side
      // Instead, we return a special flag that tells the client to use Web Speech API
      console.log(`[Browser TTS] Client-side synthesis requested for: "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"`);

      return {
        audioBuffer: Buffer.alloc(0), // No server-side audio
        audioUrl: undefined,
        ttsServiceType,
        clientSideText: text, // Signal to client to synthesize this text
        clientSideLanguage: normalizedLanguage
      };

    } catch (error) {
      console.error('[Browser TTS] Synthesis failed:', error, error instanceof Error ? error.stack : undefined);
      let errObj: { name: string; message: string };
      if (error instanceof Error) {
        errObj = { name: error.name, message: error.message };
      } else {
        errObj = { name: 'BrowserTTSUnknownError', message: 'Unknown error occurred' };
      }

      return {
        audioBuffer: Buffer.alloc(0),
        error: errObj,
        ttsServiceType
      };
    }
  }

  public async getVoices(): Promise<string[]> {
    // Return a list of common browser voice identifiers
    // The actual voices available will depend on the client's browser and OS
    return Array.from(this.supportedLanguages);
  }

  public getSupportedFormats(): string[] {
    return ['browser']; // Special format indicating browser-side synthesis
  }

  public getMaxTextLength(): number {
    return 32768; // Typical browser limit for speechSynthesis
  }
}

