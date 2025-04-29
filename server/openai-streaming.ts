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
export class SessionManager {
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
export const sessionManager = new SessionManager();

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
export class AudioProcessingService {
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
export const audioProcessor = new AudioProcessingService();

/**
 * Process streaming audio data from WebSocket
 * 
 * @param ws WebSocket connection
 * @param sessionId Unique session ID
 * @param audioBase64 Base64-encoded audio data
 * @param isFirstChunk Whether this is the first chunk in a new stream
 * @param language Language code for transcription (e.g., 'en-US')
 */
/**
 * Handles audio buffer management and triggers audio processing
 */
export async function processStreamingAudio(
  ws: WebSocket,
  sessionId: string,
  audioBase64: string,
  isFirstChunk: boolean,
  language: string
): Promise<void> {
  try {
    const audioBuffer = Buffer.from(audioBase64, 'base64');
    await manageAudioSession(sessionId, audioBuffer, isFirstChunk, language);
    await triggerAudioProcessing(ws, sessionId);
  } catch (error) {
    console.error(`${CONFIG.LOG_PREFIX} Error processing streaming audio:`, error);
    WebSocketCommunicator.sendErrorMessage(ws, 'Failed to process audio data', 'server_error');
  }
}

/**
 * Creates or updates an audio session with the provided buffer
 */
async function manageAudioSession(
  sessionId: string,
  audioBuffer: Buffer,
  isFirstChunk: boolean,
  language: string
): Promise<void> {
  if (isFirstChunk || !sessionManager.getSession(sessionId)) {
    sessionManager.createSession(sessionId, language, audioBuffer);
  } else {
    sessionManager.addAudioToSession(sessionId, audioBuffer);
  }
}

/**
 * Triggers audio processing if the session is not already being processed
 */
async function triggerAudioProcessing(ws: WebSocket, sessionId: string): Promise<void> {
  const session = sessionManager.getSession(sessionId);
  if (session && !session.transcriptionInProgress) {
    processAudioChunks(ws, sessionId).catch(error => {
      console.error(`${CONFIG.LOG_PREFIX} Error processing audio chunks:`, error);
      WebSocketCommunicator.sendErrorMessage(ws, 'Error processing audio stream', 'server_error');
    });
  }
}

/**
 * Process accumulated audio chunks for a session
 * 
 * @param ws WebSocket connection
 * @param sessionId Session ID
 */
/**
 * Process accumulated audio chunks for a session
 * Broken down into smaller functions for better maintainability
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
    const combinedBuffer = combineAndManageAudioBuffers(session);
    
    if (isBufferTooSmallForProcessing(combinedBuffer)) {
      session.transcriptionInProgress = false;
      return;
    }
    
    await transcribeAndSendResults(ws, session, combinedBuffer);
  } catch (error) {
    console.error(`${CONFIG.LOG_PREFIX} Error transcribing audio:`, error);
    WebSocketCommunicator.sendErrorMessage(ws, 'Failed to transcribe audio', 'server_error');
  } finally {
    // Mark as done processing
    session.transcriptionInProgress = false;
  }
}

/**
 * Combines audio buffers and manages buffer size
 */
function combineAndManageAudioBuffers(session: AudioStreamingSessionState): Buffer {
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
  
  return combinedBuffer;
}

/**
 * Checks if the buffer is too small for processing
 */
function isBufferTooSmallForProcessing(buffer: Buffer): boolean {
  return buffer.length < CONFIG.MIN_AUDIO_SIZE_BYTES;
}

/**
 * Transcribes audio and sends results to client
 */
async function transcribeAndSendResults(
  ws: WebSocket, 
  session: AudioStreamingSessionState, 
  audioBuffer: Buffer
): Promise<void> {
  // Transcribe using our audio processing service
  const transcriptionText = await audioProcessor.transcribeAudio(
    audioBuffer, 
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
}

/**
 * Finalize a streaming session
 * 
 * @param ws WebSocket connection
 * @param sessionId Session ID
 */
/**
 * Finalize a streaming session - broken down into smaller functions
 */
export async function finalizeStreamingSession(ws: WebSocket, sessionId: string): Promise<void> {
  try {
    const session = sessionManager.getSession(sessionId);
    if (!session) return;
    
    await processRemainingAudio(ws, session, sessionId);
    sendFinalTranscription(ws, session);
    cleanupSession(sessionId);
  } catch (error) {
    console.error(`${CONFIG.LOG_PREFIX} Error finalizing session:`, error);
  }
}

/**
 * Process any remaining audio in the session
 */
async function processRemainingAudio(ws: WebSocket, session: AudioStreamingSessionState, sessionId: string): Promise<void> {
  if (session.audioBuffer.length > 0) {
    await processAudioChunks(ws, sessionId);
  }
}

/**
 * Send the final transcription result to the client
 */
function sendFinalTranscription(ws: WebSocket, session: AudioStreamingSessionState): void {
  WebSocketCommunicator.sendTranscriptionResult(ws, {
    text: session.transcriptionText,
    isFinal: true,
    languageCode: session.language
  });
}

/**
 * Clean up the session after finalization
 */
function cleanupSession(sessionId: string): void {
  sessionManager.deleteSession(sessionId);
  console.log(`${CONFIG.LOG_PREFIX} Finalized and closed session: ${sessionId}`);
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