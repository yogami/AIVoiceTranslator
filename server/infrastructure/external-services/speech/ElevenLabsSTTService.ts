import { ISTTTranscriptionService } from '../../../services/translation/translation.interfaces';

export class ElevenLabsSTTService implements ISTTTranscriptionService {
  private readonly apiKey: string;
  private readonly baseUrl: string = 'https://api.elevenlabs.io/v1';

  constructor(apiKey: string) {
    if (!apiKey) {
      throw new Error('ElevenLabs API key is required');
    }
    this.apiKey = apiKey;
  }

  /**
   * Transcribes audio using ElevenLabs Speech-to-Text API
   */
  async transcribe(audioBuffer: Buffer, sourceLanguage: string): Promise<string> {
    if (!audioBuffer || audioBuffer.length === 0) {
      throw new Error('Audio buffer is required and cannot be empty');
    }

    const language = sourceLanguage || 'en';
    try {
      console.log(`[ElevenLabs STT] Starting transcription for ${audioBuffer.length} bytes of audio data`);
      // Create form data
      const formData = new FormData();
      // Convert buffer to blob for form data
      const audioBlob = new Blob([audioBuffer], { type: 'audio/wav' });
      formData.append('audio', audioBlob, 'audio.wav');
      // Add language parameter if supported
      if (language && language !== 'en') {
        formData.append('language', language);
      }

      const response = await fetch(`${this.baseUrl}/speech-to-text`, {
        method: 'POST',
        headers: {
          'xi-api-key': this.apiKey
        },
        body: formData
      });

      if (!response.ok) {
        const errorText = await response.text();
        const error = new Error(`ElevenLabs STT API error: ${response.status} - ${errorText}`);
        (error as any).status = response.status;
        if (this.isElevenLabsSTTError(error)) {
          console.log(`[ElevenLabs STT] API error detected - Status Code: ${response.status}`);
        }
        
        throw error;
      }

      const result = await response.json();
      
      if (!result.text) {
        throw new Error('ElevenLabs STT API returned no transcription text');
      }

      const transcription = result.text.trim();
      console.log(`[ElevenLabs STT] Transcription completed: "${transcription.substring(0, 100)}${transcription.length > 100 ? '...' : ''}"`);
      
      return transcription;

    } catch (error) {
      console.error('[ElevenLabs STT] Transcription failed:', error);
      
      if (this.isElevenLabsSTTError(error)) {
        // Re-throw API errors for fallback handling
        throw error;
      }
      
      // Wrap other errors
      throw new Error(`ElevenLabs STT transcription failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Determines if an error should trigger fallback to the next service
   */
  private isElevenLabsSTTError(error: any): boolean {
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
      console.log(`[ElevenLabs STT] API error detected - Status Code: ${errorStatus}`);
      return true;
    }
    
    // Check error message patterns
    const fallbackErrorPatterns = [
      'invalid api key',
      'unauthorized',
      'quota exceeded',
      'rate limit',
      'billing',
      'payment required',
      'service unavailable',
      'timeout',
      'server error',
      'bad gateway'
    ];
    
    for (const pattern of fallbackErrorPatterns) {
      if (errorMessage.includes(pattern)) {
        console.log(`[ElevenLabs STT] API error detected - Pattern: "${pattern}"`);
        return true;
      }
    }
    
    return false;
  }

  /**
   * Maps common language codes to ElevenLabs supported languages
   */
  private mapLanguageCode(language: string): string {
    const languageMap: { [key: string]: string } = {
      'en': 'en',
      'en-US': 'en',
      'en-GB': 'en',
      'es': 'es',
      'es-ES': 'es',
      'es-MX': 'es',
      'fr': 'fr',
      'fr-FR': 'fr',
      'de': 'de',
      'de-DE': 'de',
      'it': 'it',
      'it-IT': 'it',
      'pt': 'pt',
      'pt-BR': 'pt',
      'pt-PT': 'pt',
      'ja': 'ja',
      'ja-JP': 'ja',
      'zh': 'zh',
      'zh-CN': 'zh',
      'zh-TW': 'zh'
    };

    return languageMap[language] || 'en';
  }
}
