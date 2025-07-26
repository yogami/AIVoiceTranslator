import { OpenAI } from 'openai';
import { ITranscriptionService } from './TranscriptionServiceFactory.js';
import { AudioFileHandler } from '../handlers/AudioFileHandler.js';

/**
 * OpenAI Transcription Service Wrapper
 * Implements the ITranscriptionService interface for OpenAI Whisper API
 */
export class OpenAITranscriptionService implements ITranscriptionService {
  private openai: OpenAI;
  private audioHandler: AudioFileHandler;

  constructor(openai: OpenAI) {
    this.openai = openai;
    this.audioHandler = new AudioFileHandler();
  }

  public async transcribe(audioBuffer: Buffer, options?: { language?: string }): Promise<string> {
    try {
      console.log('[OpenAI STT] Starting transcription...');
      
      // Save audio buffer to temporary file for OpenAI API
      const tempFilePath = await this.audioHandler.createTempFile(audioBuffer);
      
      try {
        // Use OpenAI Whisper API for transcription
        const transcription = await this.openai.audio.transcriptions.create({
          file: require('fs').createReadStream(tempFilePath),
          model: 'whisper-1',
          language: options?.language || undefined,
          response_format: 'json',
        });

        const text = transcription.text.trim();
        console.log('[OpenAI STT] Transcription completed:', text.substring(0, 100) + '...');
        return text;

      } finally {
        // Clean up temporary file
        await this.audioHandler.deleteTempFile(tempFilePath);
      }

    } catch (error) {
      console.error('[OpenAI STT] Transcription failed:', error);
      throw error; // Re-throw the original error for auto-fallback to detect
    }
  }
}
