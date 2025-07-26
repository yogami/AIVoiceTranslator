import whisper from 'whisper-node';
import { ITranscriptionService } from './TranscriptionServiceFactory.js';
import { AudioFileHandler } from '../handlers/AudioFileHandler.js';

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
      const tempFilePath = await this.audioHandler.saveToTempFile(audioBuffer, 'whisper-input', 'wav');
      
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
          ? transcript.map(segment => segment.speech || '').join(' ').trim()
          : (transcript?.speech || '').trim();

        console.log('[WhisperCpp] Transcription completed:', text.substring(0, 100) + '...');
        return text;

      } finally {
        // Clean up temporary file
        await this.audioHandler.deleteFile(tempFilePath);
      }

    } catch (error) {
      console.error('[WhisperCpp] Transcription failed:', error);
      throw new Error(`WhisperCpp transcription failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}
