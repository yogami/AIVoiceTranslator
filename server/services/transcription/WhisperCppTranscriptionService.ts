// Protect working directory before importing whisper-node
const originalCwd = process.cwd();
console.log('[WhisperCpp] Protecting working directory:', originalCwd);

import whisperNode from 'whisper-node';

// Immediately restore working directory after import
if (process.cwd() !== originalCwd) {
  console.warn('[WhisperCpp] Working directory was changed by whisper-node from', originalCwd, 'to', process.cwd());
  process.chdir(originalCwd);
  console.log('[WhisperCpp] Restored working directory to:', process.cwd());
}

import { ITranscriptionService } from './TranscriptionServiceFactory.js';
import { AudioFileHandler } from '../handlers/AudioFileHandler.js';

const whisper = whisperNode.whisper || whisperNode.default;

/**
 * WhisperCpp Transcription Service
 * Free local alternative to OpenAI Whisper API using whisper.cpp
 */
export class WhisperCppTranscriptionService implements ITranscriptionService {
  private audioHandler: AudioFileHandler;
  private readonly model: string = 'base'; // Using 'base' model for good balance of speed/accuracy

  constructor() {
    this.audioHandler = new AudioFileHandler();
    console.log('[WhisperCpp] Service initialized with model:', this.model);
  }

  public async transcribe(audioBuffer: Buffer, options?: { language?: string }): Promise<string> {
    try {
      console.log('[WhisperCpp] Starting transcription...');
      
      // Save audio buffer to temporary file
      const tempFilePath = await this.audioHandler.createTempFile(audioBuffer);
      
      try {
        // Transcribe using whisper-node
        const transcript = await whisper(tempFilePath, {
          modelName: this.model,
          language: options?.language || 'auto',
          whisperOptions: {
            outputInText: true,
            outputInVtt: false,
            outputInSrt: false,
            gen_file_txt: false,
            gen_file_subtitle: false,
            gen_file_vtt: false,
            word_timestamps: false
          }
        });

        // Extract text from the transcript
        const text = Array.isArray(transcript) 
          ? transcript.map((segment: any) => segment.speech || '').join(' ').trim()
          : (transcript?.speech || '').trim();

        console.log('[WhisperCpp] Transcription completed:', text.substring(0, 100) + '...');
        return text;

      } finally {
        // Clean up temporary file
        await this.audioHandler.deleteTempFile(tempFilePath);
      }

    } catch (error) {
      console.error('[WhisperCpp] Transcription failed:', error);
      throw new Error(`WhisperCpp transcription failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}
