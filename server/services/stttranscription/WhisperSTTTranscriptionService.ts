/**
 * WhisperSTTTranscriptionService - Placeholder implementation
 */

import { ISTTTranscriptionService } from '../translation/translation.interfaces.js';

export class WhisperSTTTranscriptionService implements ISTTTranscriptionService {
  async transcribe(audioBuffer: Buffer, sourceLanguage: string): Promise<string> {
    // Placeholder implementation
    throw new Error('WhisperSTTTranscriptionService not implemented');
  }
}
