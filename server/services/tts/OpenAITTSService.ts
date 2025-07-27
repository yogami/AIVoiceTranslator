/**
 * OpenAI TTS Service Wrapper
 * Wraps the existing OpenAI TTS implementation to match the ITTSService interface
 */

import { ITTSService } from './ElevenLabsTTSService.js';
import { textToSpeechService } from '../textToSpeech/TextToSpeechService.js';

export class OpenAITTSService implements ITTSService {
  private isInitialized = false;
  
  constructor() {
    this.isInitialized = true;
    console.log('[OpenAI TTS] Service initialized');
  }

  private isOpenAIError(error: any): boolean {
    if (!error) return false;
    
    const errorMessage = error.message?.toLowerCase() || '';
    const errorStatus = error.status || error.code;
    
    // HTTP status codes that should trigger fallback
    const fallbackStatusCodes = [
      401, // Unauthorized (invalid API key)
      402, // Payment Required (billing issue)
      403, // Forbidden (quota exceeded, access denied)
      429, // Too Many Requests (rate limit)
      500, // Internal Server Error
      502, // Bad Gateway
      503, // Service Unavailable
      504  // Gateway Timeout
    ];
    
    // Check status codes
    if (fallbackStatusCodes.includes(errorStatus)) {
      console.log(`[OpenAI TTS] API error detected - Status Code: ${errorStatus}`);
      return true;
    }
    
    // Check error message patterns
    const fallbackErrorPatterns = [
      'rate limit', 'quota', 'billing', 'payment',
      'unauthorized', 'forbidden', 'invalid api key',
      'service unavailable', 'timeout', 'network error',
      'openai'
    ];
    
    return fallbackErrorPatterns.some(pattern => errorMessage.includes(pattern));
  }

  private mapLanguageToVoice(language: string = 'en-US', voiceGender: string = 'female'): string {
    // Voice mapping for different languages and genders
    // OpenAI TTS supports: alloy, echo, fable, onyx, nova, shimmer
    const voiceMap: Record<string, Record<string, string>> = {
      'en-US': {
        'female': 'nova',    // Natural, versatile female voice
        'male': 'onyx'       // Deep, masculine voice
      },
      'en-GB': {
        'female': 'shimmer', // Warm, expressive female voice
        'male': 'echo'       // Refined male voice
      },
      'fr-FR': {
        'female': 'alloy',   // Neutral, balanced voice
        'male': 'echo'       // Works well for French
      },
      'es-ES': {
        'female': 'nova',    // Good for Spanish
        'male': 'onyx'       // Deep voice for Spanish
      },
      'de-DE': {
        'female': 'shimmer', // Expressive for German
        'male': 'echo'       // Clear for German
      }
    };

    return voiceMap[language]?.[voiceGender] || 'nova'; // Default to nova
  }

  public async synthesize(text: string, options: { language?: string; voice?: string } = {}): Promise<{ audioBuffer?: Buffer; audioUrl?: string; error?: string }> {
    if (!this.isInitialized) {
      return {
        error: 'OpenAI TTS service not initialized'
      };
    }

    if (!text || text.trim().length === 0) {
      throw new Error('Text cannot be empty');
    }

    const { language = 'en-US', voice = 'female' } = options;
    const selectedVoice = this.mapLanguageToVoice(language, voice);

    try {
      console.log(`[OpenAI TTS] Synthesizing text (${text.length} chars) with voice: ${selectedVoice} for language: ${language}`);
      
      // Use the existing textToSpeechService with correct interface
      const audioBuffer = await textToSpeechService.synthesizeSpeech({
        text: text,
        languageCode: language,
        voice: selectedVoice,
        speed: 1.0,
        preserveEmotions: true
      });

      if (audioBuffer && audioBuffer.length > 0) {
        console.log(`[OpenAI TTS] Successfully synthesized ${audioBuffer.length} bytes of audio`);
        
        return {
          audioBuffer: audioBuffer,
          audioUrl: undefined // OpenAI returns buffer directly
        };
      } else {
        throw new Error('OpenAI TTS returned no audio data');
      }

    } catch (error) {
      console.error('[OpenAI TTS] Synthesis failed:', error);
      
      if (this.isOpenAIError(error)) {
        // Re-throw with clear indication this should trigger fallback
        const fallbackError = new Error(`OpenAI TTS failed: ${error instanceof Error ? error.message : String(error)}`);
        (fallbackError as any).shouldFallback = true;
        (fallbackError as any).originalError = error;
        throw fallbackError;
      }
      
      // For non-API errors, still throw but don't mark for fallback
      throw error;
    }
  }

  public async getAvailableVoices(): Promise<Array<{ name: string; id: string; language: string; gender: string }>> {
    // Return OpenAI TTS available voices
    return [
      { name: 'Alloy', id: 'alloy', language: 'multi', gender: 'neutral' },
      { name: 'Echo', id: 'echo', language: 'multi', gender: 'male' },
      { name: 'Fable', id: 'fable', language: 'multi', gender: 'male' },
      { name: 'Onyx', id: 'onyx', language: 'multi', gender: 'male' },
      { name: 'Nova', id: 'nova', language: 'multi', gender: 'female' },
      { name: 'Shimmer', id: 'shimmer', language: 'multi', gender: 'female' }
    ];
  }
}
