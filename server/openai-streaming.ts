/**
 * OpenAI Streaming Audio Transcription Service
 * 
 * Provides real-time transcription for audio streams using OpenAI's Whisper model.
 * 
 * This module follows SOLID principles:
 * - Single Responsibility: Each class and function has a specific purpose
 * - Open/Closed: Components can be extended without modification
 * - Liskov Substitution: Interfaces define contracts that implementations must follow
 * - Interface Segregation: Each interface exposes only what clients need
 * - Dependency Inversion: High-level modules depend on abstractions
 */
import OpenAI from 'openai';
import WebSocket from 'ws';
import { WebSocketState } from './websocket';

// Configuration constants - making magic numbers explicit
const CONFIG = {
  CLEANUP_INTERVAL_MS: 30000,    // How often to check for and remove inactive sessions
  SESSION_MAX_AGE_MS: 60000,     // How long a session can be inactive before cleanup
  MIN_AUDIO_SIZE_BYTES: 2000,    // Minimum audio chunk size to process
  MAX_AUDIO_BUFFER_BYTES: 640000, // ~5 seconds at 128kbps
  WHISPER_MODEL: 'whisper-1',    // OpenAI model to use for transcription
  LOG_PREFIX: '[OpenAI Streaming]'// Prefix for all logs from this module
};

// Log API key status (masked for security)
console.log(`OpenAI Streaming - API key status: ${process.env.OPENAI_API_KEY ? 'Present' : 'Missing'}`);

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

// Define interfaces for our domain model
interface TranscriptionResult {
  text: string;
  isFinal: boolean;
  languageCode: string;
  confidence?: number;
}

interface AudioStreamingSessionState {
  sessionId: string;
  language: string;
  isProcessing: boolean;
  audioBuffer: Buffer[];
  lastChunkTime: number;
  transcriptionText: string;
  transcriptionInProgress: boolean;
}

/**
 * Session Manager - responsible for maintaining session state
 * Follows the repository pattern for data access
 */
class SessionManager {
  private sessions = new Map<string, AudioStreamingSessionState>();
  
  /**
   * Create a new streaming session
   */
  createSession(sessionId: string, language: string, initialBuffer: Buffer): AudioStreamingSessionState {
    const session: AudioStreamingSessionState = {
      sessionId,
      language,
      isProcessing: false,
      audioBuffer: [initialBuffer],
      lastChunkTime: Date.now(),
      transcriptionText: '',
      transcriptionInProgress: false
    };
    
    this.sessions.set(sessionId, session);
    console.log(`${CONFIG.LOG_PREFIX} Created new session: ${sessionId}, language: ${language}`);
    return session;
  }
  
  /**
   * Get an existing session
   */
  getSession(sessionId: string): AudioStreamingSessionState | undefined {
    return this.sessions.get(sessionId);
  }
  
  /**
   * Add audio data to an existing session
   */
  addAudioToSession(sessionId: string, audioBuffer: Buffer): void {
    const session = this.getSession(sessionId);
    if (session) {
      session.audioBuffer.push(audioBuffer);
      session.lastChunkTime = Date.now();
    }
  }
  
  /**
   * Delete a session
   */
  deleteSession(sessionId: string): boolean {
    const result = this.sessions.delete(sessionId);
    if (result) {
      console.log(`${CONFIG.LOG_PREFIX} Deleted session: ${sessionId}`);
    }
    return result;
  }
  
  /**
   * Clean up inactive sessions
   */
  cleanupInactiveSessions(maxAgeMs: number = CONFIG.SESSION_MAX_AGE_MS): void {
    const now = Date.now();
    
    // Convert entries to array first (avoids downlevelIteration issues)
    for (const [sessionId, session] of Array.from(this.sessions.entries())) {
      const sessionAge = now - session.lastChunkTime;
      
      if (sessionAge > maxAgeMs) {
        console.log(`${CONFIG.LOG_PREFIX} Cleaning up inactive session: ${sessionId}, age: ${sessionAge}ms`);
        this.sessions.delete(sessionId);
      }
    }
  }
  
  /**
   * Get all sessions
   */
  getAllSessions(): Map<string, AudioStreamingSessionState> {
    return this.sessions;
  }
}

// Singleton instance of the session manager
const sessionManager = new SessionManager();

// Export for testing
export { sessionManager };

/**
 * WebSocket communication utilities
 * Encapsulates message formatting and sending
 */
class WebSocketCommunicator {
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
class AudioProcessingService {
  private openai: OpenAI;
  
  constructor() {
    // Get the OpenAI client from our factory
    this.openai = OpenAIClientFactory.getInstance();
  }
  
  /**
   * Process audio buffer and get transcription
   */
  async transcribeAudio(audioBuffer: Buffer, language: string): Promise<string> {
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
}

// Create a single instance of the audio processor
const audioProcessor = new AudioProcessingService();

/**
 * Process streaming audio data from WebSocket
 * 
 * @param ws WebSocket connection
 * @param sessionId Unique session ID
 * @param audioBase64 Base64-encoded audio data
 * @param isFirstChunk Whether this is the first chunk in a new stream
 * @param language Language code for transcription (e.g., 'en-US')
 */
export async function processStreamingAudio(
  ws: WebSocket,
  sessionId: string,
  audioBase64: string,
  isFirstChunk: boolean,
  language: string
): Promise<void> {
  try {
    // Convert base64 to buffer
    const audioBuffer = Buffer.from(audioBase64, 'base64');
    
    // Initialize session if it's the first chunk or doesn't exist
    if (isFirstChunk || !sessionManager.getSession(sessionId)) {
      sessionManager.createSession(sessionId, language, audioBuffer);
    } else {
      // Add to existing session
      sessionManager.addAudioToSession(sessionId, audioBuffer);
    }
    
    // Process if not already processing
    const session = sessionManager.getSession(sessionId);
    if (session && !session.transcriptionInProgress) {
      // Start processing in the background
      processAudioChunks(ws, sessionId).catch(error => {
        console.error(`${CONFIG.LOG_PREFIX} Error processing audio chunks:`, error);
        WebSocketCommunicator.sendErrorMessage(ws, 'Error processing audio stream', 'server_error');
      });
    }
  } catch (error) {
    console.error(`${CONFIG.LOG_PREFIX} Error processing streaming audio:`, error);
    WebSocketCommunicator.sendErrorMessage(ws, 'Failed to process audio data', 'server_error');
  }
}

/**
 * Process accumulated audio chunks for a session
 * 
 * @param ws WebSocket connection
 * @param sessionId Session ID
 */
async function processAudioChunks(ws: WebSocket, sessionId: string): Promise<void> {
  const session = sessionManager.getSession(sessionId);
  if (!session || session.audioBuffer.length === 0) return;
  
  // Mark as processing to prevent concurrent processing
  session.transcriptionInProgress = true;
  
  try {
    // Create a single buffer from all chunks
    const combinedBuffer = Buffer.concat(session.audioBuffer);
    
    // Manage buffer size to maintain context but reduce processing load
    if (combinedBuffer.length > CONFIG.MAX_AUDIO_BUFFER_BYTES) {
      // Keep only the most recent audio
      session.audioBuffer = [combinedBuffer.slice(-CONFIG.MAX_AUDIO_BUFFER_BYTES)];
    } else {
      // Clear processed audio chunks
      session.audioBuffer = [];
    }
    
    // Skip processing if buffer is too small
    if (combinedBuffer.length < CONFIG.MIN_AUDIO_SIZE_BYTES) {
      session.transcriptionInProgress = false;
      return;
    }
    
    // Transcribe using our audio processing service
    const transcriptionText = await audioProcessor.transcribeAudio(
      combinedBuffer, 
      session.language
    );
    
    // Send result if we got meaningful text
    if (transcriptionText && transcriptionText.trim() !== '') {
      // Store the latest transcription for finalization
      session.transcriptionText = transcriptionText;
      
      // Send back transcription result
      WebSocketCommunicator.sendTranscriptionResult(ws, {
        text: transcriptionText,
        isFinal: false,
        languageCode: session.language
      });
    }
  } catch (error) {
    console.error(`${CONFIG.LOG_PREFIX} Error transcribing audio:`, error);
    WebSocketCommunicator.sendErrorMessage(ws, 'Failed to transcribe audio', 'server_error');
  } finally {
    // Mark as done processing
    session.transcriptionInProgress = false;
  }
}

/**
 * Finalize a streaming session
 * 
 * @param ws WebSocket connection
 * @param sessionId Session ID
 */
export async function finalizeStreamingSession(ws: WebSocket, sessionId: string): Promise<void> {
  try {
    const session = sessionManager.getSession(sessionId);
    if (!session) return;
    
    // Process any remaining audio
    if (session.audioBuffer.length > 0) {
      await processAudioChunks(ws, sessionId);
    }
    
    // Send final transcription
    WebSocketCommunicator.sendTranscriptionResult(ws, {
      text: session.transcriptionText,
      isFinal: true,
      languageCode: session.language
    });
    
    // Clean up the session
    sessionManager.deleteSession(sessionId);
    console.log(`${CONFIG.LOG_PREFIX} Finalized and closed session: ${sessionId}`);
  } catch (error) {
    console.error(`${CONFIG.LOG_PREFIX} Error finalizing session:`, error);
  }
}

/**
 * Clean up inactive streaming sessions
 * This should be called periodically to prevent memory leaks
 */
export function cleanupInactiveStreamingSessions(maxAgeMs: number = CONFIG.SESSION_MAX_AGE_MS): void {
  sessionManager.cleanupInactiveSessions(maxAgeMs);
}

// Set up a periodic cleanup task
setInterval(() => {
  cleanupInactiveStreamingSessions();
}, CONFIG.CLEANUP_INTERVAL_MS);