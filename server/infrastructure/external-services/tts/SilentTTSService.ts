import { ITTSService, TTSResult } from '../../../services/tts/TTSService';

/**
 * Silent TTS Service
 * Produces no audio and returns an empty buffer with ttsServiceType 'silent'.
 */
export class SilentTTSService implements ITTSService {
  async synthesize(text: string, options: { language?: string; voice?: string } = {}): Promise<TTSResult> {
    return {
      audioBuffer: Buffer.alloc(0),
      ttsServiceType: 'silent'
    };
  }
}


