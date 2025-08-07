import { ITTSService, TTSResult } from './TTSService';
import { ElevenLabsEmotionControlService, EmotionContext } from './EmotionControlService';
import * as fs from 'fs';
const LOG_PREFIX = '[ElevenLabsTTSService]';
function log(...args: any[]) {
    console.log(LOG_PREFIX, ...args);
}
(global as any).fetch = fetch;

export class ElevenLabsTTSService implements ITTSService {
  private apiKey: string;
  private baseUrl = 'https://api.elevenlabs.io/v1';
  private defaultVoiceId = 'EXAVITQu4vr4xnSDxMaL';
  private emotionControlService: ElevenLabsEmotionControlService | null = null;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
    // Initialize emotion control service if API key is available
    try {
      this.emotionControlService = new ElevenLabsEmotionControlService();
    } catch (error) {
      console.warn('[ElevenLabsTTSService] Emotion control unavailable:', error instanceof Error ? error.message : error);
    }
  }

  private getVoiceId(language: string = 'en-US', voiceGender: string = 'female'): string {
    const voiceMap: Record<string, Record<string, string>> = {
      'en-US': {
        'female': 'EXAVITQu4vr4xnSDxMaL',
        'male': 'VR6AewLTigWG4xSOukaG'
      },
      'en-GB': {
        'female': 'XrExE9yKIg1WjnnlVkGX',
        'male': 'VR6AewLTigWG4xSOukaG'
      },
    };
    return voiceMap[language]?.[voiceGender] || this.defaultVoiceId;
  }

  public async synthesize(text: string, options: { language?: string; voice?: string; emotionContext?: EmotionContext } = {}): Promise<TTSResult> {
    const voiceId = this.getVoiceId(options.language || 'en-US', options.voice || 'female');
    log('synthesize called', { text, options });

    const ttsServiceType = 'elevenlabs';

    // Use emotion control service if available and emotion context provided
    if (this.emotionControlService && options.emotionContext) {
      try {
        log('Using advanced emotion control for synthesis');
        const emotionalResult = await this.emotionControlService.applyEmotionalContext({
          text,
          language: options.language || 'en-US',
          voiceId,
          emotionContext: options.emotionContext
        });

        if (emotionalResult.audioBuffer) {
          log('Emotional synthesis successful, audio buffer length:', emotionalResult.audioBuffer.length);
          return { 
            audioBuffer: emotionalResult.audioBuffer, 
            audioUrl: undefined, 
            error: undefined, 
            ttsServiceType 
          };
        }
      } catch (emotionError) {
        log('Emotion control failed, falling back to standard synthesis:', emotionError);
        // Continue with standard synthesis below
      }
    }

    // Standard synthesis with enhanced settings
    const requestBody: any = {
      text: text,
      model_id: 'eleven_multilingual_v2', // Use advanced multilingual model
      voice_settings: {
        stability: 0.6,      // Improved stability
        similarity_boost: 0.7, // Enhanced similarity
        style: 0.3,          // Add some style variation
        use_speaker_boost: true
      }
    };

    try {
      log('Making ElevenLabs API request', { url: `${this.baseUrl}/text-to-speech/${voiceId}`, apiKeyPresent: !!this.apiKey, requestBody });
      const response = await fetch(`${this.baseUrl}/text-to-speech/${voiceId}`, {
        method: 'POST',
        headers: {
          'Accept': 'audio/mpeg',
          'Content-Type': 'application/json',
          'xi-api-key': this.apiKey
        },
        body: JSON.stringify(requestBody)
      });

      log('ElevenLabs API response status:', response.status);
      if (!response.ok) {
        const errorText = await response.text();
        log('API error', response.status, errorText);
        throw new Error(`ElevenLabs API error: ${response.status} - ${errorText}`);
      }

      const audioBuffer = Buffer.from(await response.arrayBuffer());
      log('API call successful, received audio buffer, length:', audioBuffer.length);
      return { audioBuffer, audioUrl: undefined, error: undefined, ttsServiceType };
    } catch (err: any) {
      log('Exception during ElevenLabs API call', err, err?.stack);
      // Extra error logging for integration test visibility
      console.error('[ElevenLabsTTSService] Exception:', err, err?.message, err?.stack);
      return { audioBuffer: Buffer.alloc(0), error: err?.message || 'Unknown error', ttsServiceType };
    }
  }
}
