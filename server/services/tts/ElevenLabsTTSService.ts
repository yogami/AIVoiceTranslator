/**
 * ElevenLabs TTS Service
 * Premium text-to-speech service using ElevenLabs API
 */

export interface ITTSService {
  synthesize(text: string, options?: { language?: string; voice?: string }): Promise<{ audioBuffer?: Buffer; audioUrl?: string; error?: string }>;
}

export interface ElevenLabsVoice {
  voice_id: string;
  name: string;
  category: string;
  labels: Record<string, string>;
}

export class ElevenLabsTTSService implements ITTSService {
  private apiKey: string;
  private baseUrl = 'https://api.elevenlabs.io/v1';
  private defaultVoiceId = 'EXAVITQu4vr4xnSDxMaL'; // Bella voice (female)
  
  constructor(apiKey: string) {
    this.apiKey = apiKey;
    console.log('[ElevenLabs TTS] Service initialized');
  }

  private getVoiceId(language: string = 'en-US', voiceGender: string = 'female'): string {
    // Voice mapping for different languages and genders
    const voiceMap: Record<string, Record<string, string>> = {
      'en-US': {
        'female': 'EXAVITQu4vr4xnSDxMaL', // Bella
        'male': 'VR6AewLTigWG4xSOukaG'    // Sam
      },
      'en-GB': {
        'female': 'XrExE9yKIg1WjnnlVkGX', // Matilda
        'male': 'VR6AewLTigWG4xSOukaG'    // Sam
      },
      'fr-FR': {
        'female': 'EXAVITQu4vr4xnSDxMaL', // Default for now
        'male': 'VR6AewLTigWG4xSOukaG'    // Default for now
      },
      'es-ES': {
        'female': 'EXAVITQu4vr4xnSDxMaL', // Default for now
        'male': 'VR6AewLTigWG4xSOukaG'    // Default for now
      },
      'de-DE': {
        'female': 'EXAVITQu4vr4xnSDxMaL', // Default for now
        'male': 'VR6AewLTigWG4xSOukaG'    // Default for now
      }
    };

    return voiceMap[language]?.[voiceGender] || this.defaultVoiceId;
  }

  private isElevenLabsError(error: any): boolean {
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
      console.log(`[ElevenLabs TTS] API error detected - Status Code: ${errorStatus}`);
      return true;
    }
    
    // Check error message patterns
    const fallbackErrorPatterns = [
      'rate limit', 'quota', 'billing', 'payment',
      'unauthorized', 'forbidden', 'invalid api key',
      'service unavailable', 'timeout', 'network error'
    ];
    
    return fallbackErrorPatterns.some(pattern => errorMessage.includes(pattern));
  }

  public async synthesize(text: string, options: { language?: string; voice?: string } = {}): Promise<{ audioBuffer?: Buffer; audioUrl?: string; error?: string }> {
    if (!text || text.trim().length === 0) {
      throw new Error('Text cannot be empty');
    }

    if (text.length > 2500) {
      console.warn('[ElevenLabs TTS] Text length exceeds recommended limit, truncating');
      text = text.substring(0, 2500);
    }

    const { language = 'en-US', voice = 'female' } = options;
    const voiceId = this.getVoiceId(language, voice);

    try {
      console.log(`[ElevenLabs TTS] Synthesizing text (${text.length} chars) with voice: ${voiceId}`);
      
      const response = await fetch(`${this.baseUrl}/text-to-speech/${voiceId}`, {
        method: 'POST',
        headers: {
          'Accept': 'audio/mpeg',
          'Content-Type': 'application/json',
          'xi-api-key': this.apiKey
        },
        body: JSON.stringify({
          text: text,
          model_id: 'eleven_monolingual_v1',
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.5,
            style: 0.0,
            use_speaker_boost: true
          }
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        const error = new Error(`ElevenLabs API error: ${response.status} - ${errorText}`);
        (error as any).status = response.status;
        throw error;
      }

      const audioBuffer = Buffer.from(await response.arrayBuffer());
      
      console.log(`[ElevenLabs TTS] Successfully synthesized ${audioBuffer.length} bytes of audio`);
      
      return {
        audioBuffer,
        audioUrl: undefined // ElevenLabs returns audio directly
      };

    } catch (error) {
      console.error('[ElevenLabs TTS] Synthesis failed:', error);
      
      if (this.isElevenLabsError(error)) {
        // Re-throw with clear indication this should trigger fallback
        const fallbackError = new Error(`ElevenLabs TTS failed: ${error instanceof Error ? error.message : String(error)}`);
        (fallbackError as any).shouldFallback = true;
        (fallbackError as any).originalError = error;
        throw fallbackError;
      }
      
      // For non-API errors, still throw but don't mark for fallback
      throw error;
    }
  }

  public async getAvailableVoices(): Promise<ElevenLabsVoice[]> {
    try {
      const response = await fetch(`${this.baseUrl}/voices`, {
        headers: {
          'xi-api-key': this.apiKey
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch voices: ${response.status}`);
      }

      const data = await response.json();
      return data.voices || [];
    } catch (error) {
      console.error('[ElevenLabs TTS] Failed to fetch voices:', error);
      return [];
    }
  }
}
