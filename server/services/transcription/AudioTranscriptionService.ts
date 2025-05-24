/**
 * Audio Transcription Service
 * 
 * Handles transcription of audio streams using OpenAI's Whisper model.
 */
import OpenAI from 'openai';
import WebSocket from 'ws';
import { WebSocketState } from '../../websocket';

// Configuration constants - making magic numbers explicit
const CONFIG = {
  MIN_AUDIO_SIZE_BYTES: 2000,    // Minimum audio chunk size to process
  MAX_AUDIO_BUFFER_BYTES: 640000, // ~5 seconds at 128kbps
  WHISPER_MODEL: 'whisper-1',    // OpenAI model to use for transcription
  LOG_PREFIX: '[AudioTranscriptionService]' // Prefix for all logs from this module
};

// Define interfaces for our domain model
interface TranscriptionResult {
  text: string;
  isFinal: boolean;
  languageCode: string;
  confidence?: number;
}

/**
 * OpenAI client initialization - follows the factory pattern
 * Using a class instead of a global variable for better encapsulation
 */
class OpenAIClientFactory {
  private static instance: OpenAI;
  
  /**
   * Get the OpenAI client instance (singleton pattern)
   */
  public static getInstance(): OpenAI {
    if (!this.instance) {
      try {
        this.instance = new OpenAI({ 
          apiKey: process.env.OPENAI_API_KEY || 'sk-placeholder-for-initialization-only'
        });
        console.log('OpenAI Streaming - client initialized successfully');
      } catch (error) {
        console.error('OpenAI Streaming - Error initializing client:', error);
        // Create a placeholder client that will throw proper errors when methods are called
        this.instance = new OpenAI({ apiKey: 'sk-placeholder-for-initialization-only' });
      }
    }
    return this.instance;
  }
}

/**
 * WebSocket communication utilities
 * Encapsulates message formatting and sending
 */
export class WebSocketCommunicator {
  /**
   * Send a transcription result over WebSocket
   */
  static sendTranscriptionResult(
    ws: WebSocket, 
    result: TranscriptionResult
  ): void {
    this.sendMessage(ws, {
      type: 'transcription',
      ...result
    });
  }
  
  /**
   * Send an error message over WebSocket
   */
  static sendErrorMessage(
    ws: WebSocket, 
    message: string, 
    errorType: string = 'server_error'
  ): void {
    this.sendMessage(ws, {
      type: 'error',
      message,
      errorType
    });
  }
  
  /**
   * Send a generic message over WebSocket
   * Private helper method used by other public methods
   */
  private static sendMessage(ws: WebSocket, message: any): void {
    // Only send if the connection is open
    if (ws.readyState === WebSocketState.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }
}

/**
 * Audio Processing Service - handles transcription using OpenAI
 */
export class AudioTranscriptionService {
  private openai: OpenAI;
  
  constructor() {
    // Get the OpenAI client from our factory
    this.openai = OpenAIClientFactory.getInstance();
  }
  
  /**
   * Process audio buffer and get transcription
   */
  async transcribeAudio(audioBuffer: Buffer, language: string): Promise<string> {
    if (audioBuffer.length < CONFIG.MIN_AUDIO_SIZE_BYTES) {
      console.log(`${CONFIG.LOG_PREFIX} Audio buffer too small for transcription: ${audioBuffer.length} bytes`);
      return '';
    }
    
    try {
      // Create file from buffer
      const webmBlob = new Blob([audioBuffer], { type: 'audio/webm' });
      const file = new File([webmBlob], 'audio.webm', { type: 'audio/webm' });
      
      // Get base language code without region (e.g., 'en' from 'en-US')
      const baseLanguage = language.split('-')[0];
      
      // Use OpenAI to transcribe
      const transcription = await this.openai.audio.transcriptions.create({
        file: file,
        model: CONFIG.WHISPER_MODEL,
        language: baseLanguage,
        response_format: 'json',
      });
      
      return transcription.text || '';
    } catch (error) {
      console.error(`${CONFIG.LOG_PREFIX} Transcription error:`, error);
      throw new Error(`Transcription failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  /**
   * Truncate a buffer if it exceeds the maximum size
   * Extracted helper method to manage buffer size
   */
  truncateAudioBuffer(buffer: Buffer): Buffer {
    if (buffer.length > CONFIG.MAX_AUDIO_BUFFER_BYTES) {
      return buffer.slice(-CONFIG.MAX_AUDIO_BUFFER_BYTES);
    }
    return buffer;
  }
}

// Create a single instance of the audio processor
export const audioTranscriptionService = new AudioTranscriptionService();