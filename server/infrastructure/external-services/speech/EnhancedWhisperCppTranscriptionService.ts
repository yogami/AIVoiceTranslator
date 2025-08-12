import { ISTTTranscriptionService } from '../../../services/translation/translation.interfaces';
import { WhisperCppSTTTranscriptionService } from './WhisperCppTranscriptionService';
import { VoiceIsolationService } from '../audio/VoiceIsolationService';

/**
 * Enhanced Whisper.cpp STT Service
 * Applies optional voice isolation before transcribing with Whisper.cpp.
 * If voice isolation is unavailable (no API key or failure), it transparently
 * falls back to using the original audio buffer.
 */
export class EnhancedWhisperCppSTTService implements ISTTTranscriptionService {
  private readonly baseService: WhisperCppSTTTranscriptionService;
  private voiceIsolation: VoiceIsolationService | null = null;

  constructor() {
    this.baseService = new WhisperCppSTTTranscriptionService();
    try {
      this.voiceIsolation = new VoiceIsolationService();
      // If constructed successfully, it's available
      console.log('[EnhancedWhisper] Voice isolation available');
    } catch (err) {
      // Missing key or unavailable; proceed without isolation
      this.voiceIsolation = null;
      console.log('[EnhancedWhisper] Voice isolation not available, continuing without enhancement');
    }
  }

  async transcribe(audioBuffer: Buffer, sourceLanguage?: string): Promise<string> {
    let bufferToUse = audioBuffer;
    if (this.voiceIsolation?.isAvailable()) {
      try {
        bufferToUse = await this.voiceIsolation.isolateVoice(audioBuffer, {
          removeBackgroundNoise: true,
          isolatePrimarySpeaker: true,
          enhancementStrength: 0.8
        });
      } catch (err) {
        // If enhancement fails for any reason, revert to original audio
        bufferToUse = audioBuffer;
      }
    }
    return this.baseService.transcribe(bufferToUse, sourceLanguage || 'en');
  }
}


