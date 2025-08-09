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

  private normalizeToISO6391(input?: string): string | undefined {
    if (!input) return undefined;
    const value = input.trim().toLowerCase();
    if (!value || value === 'auto') return undefined;

    // Common language-name mappings
    const nameMap: Record<string, string> = {
      english: 'en', german: 'de', spanish: 'es', french: 'fr', italian: 'it',
      portuguese: 'pt', japanese: 'ja', korean: 'ko', chinese: 'zh', hindi: 'hi',
      arabic: 'ar', russian: 'ru', turkish: 'tr', dutch: 'nl', swedish: 'sv',
      danish: 'da', norwegian: 'no', finnish: 'fi', polish: 'pl', czech: 'cs',
      hungarian: 'hu', thai: 'th', vietnamese: 'vi', indonesian: 'id', ukrainian: 'uk'
    };
    if (nameMap[value]) return nameMap[value];

    // Locale forms like de-de, en_us → take primary subtag
    const normalized = value.replace('_', '-');
    const primary = normalized.split('-')[0];
    if (/^[a-z]{2}$/.test(primary)) return primary;

    // If unrecognized, omit to let API auto-detect
    return undefined;
  }

  private detectMimeType(buffer: Buffer): string | undefined {
    if (buffer.length < 12) return undefined;
    // WAV: 'RIFF' .... 'WAVE'
    if (buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WAVE') {
      return 'audio/wav';
    }
    // OGG: 'OggS'
    if (buffer.toString('ascii', 0, 4) === 'OggS') {
      return 'audio/ogg';
    }
    // WebM (EBML): 0x1A45DFA3
    if (buffer[0] === 0x1a && buffer[1] === 0x45 && buffer[2] === 0xdf && buffer[3] === 0xa3) {
      return 'audio/webm';
    }
    // MP3: ID3 tag or frame sync 0xFF Ex
    if (buffer.toString('ascii', 0, 3) === 'ID3' || (buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0)) {
      return 'audio/mpeg';
    }
    // MP4/AAC (ftyp* box commonly at 4..8)
    // Look for 'ftyp' box within first 16 bytes
    for (let i = 0; i < Math.min(16, buffer.length - 3); i++) {
      if (
        buffer[i] === 0x66 && // f
        buffer[i + 1] === 0x74 && // t
        buffer[i + 2] === 0x79 && // y
        buffer[i + 3] === 0x70 // p
      ) {
        return 'audio/mp4';
      }
    }
    return undefined;
  }

  public async transcribe(audioBuffer: Buffer, sourceLanguage: string): Promise<string> {
    try {
      console.log('[OpenAI STT] Starting transcription...');
      // Save audio buffer to temporary file for OpenAI API
      const mimeTypeHint = this.detectMimeType(audioBuffer);
      const tempFilePath = await this.audioHandler.createTempFile(audioBuffer, { mimeTypeHint });
      try {
        const language = this.normalizeToISO6391(sourceLanguage);
        // Use OpenAI Whisper API for transcription
        const transcription = await this.openai.audio.transcriptions.create({
          file: fs.createReadStream(tempFilePath),
          model: 'whisper-1',
          language: language,
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
