import OpenAI from 'openai';
import fs from 'fs';
import { ISTTTranscriptionService } from '../../../services/translation/translation.interfaces';
import { AudioFileHandler } from '../../handlers/AudioFileHandler';

/**
 * OpenAI Transcription Service Wrapper
 * Implements the ITranscriptionService interface for OpenAI Whisper API
 */
export class OpenAISTTTranscriptionService implements ISTTTranscriptionService {
  private openai: OpenAI;
  private audioHandler: AudioFileHandler;

  constructor(openai: OpenAI) {
    this.openai = openai;
    this.audioHandler = new AudioFileHandler();
  }

  public async transcribe(audioBuffer: Buffer, sourceLanguage: string): Promise<string> {
    try {
      console.log('[OpenAI STT] Starting transcription...');
      // Save audio buffer to temporary file for OpenAI API
      const tempFilePath = await this.audioHandler.createTempFile(audioBuffer);
      try {
        // Use OpenAI Whisper API for transcription
        const transcription = await this.openai.audio.transcriptions.create({
          file: fs.createReadStream(tempFilePath),
          model: 'whisper-1',
          language: sourceLanguage || undefined,
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
