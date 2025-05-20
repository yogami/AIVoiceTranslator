/**
 * Streaming Audio Processor
 * 
 * Handles audio stream processing, transcription, and WebSocket communication
 */
import WebSocket from 'ws';
import { AudioTranscriptionService, WebSocketCommunicator } from './AudioTranscriptionService';
import { AudioSessionManager, AudioStreamingSessionState } from './AudioSessionManager';
import { sessionManager } from './AudioSessionManager';
import { audioTranscriptionService } from './AudioTranscriptionService';

// Configuration constants
const CONFIG = {
  CLEANUP_INTERVAL_MS: 30000,    // How often to check for and remove inactive sessions
  SESSION_MAX_AGE_MS: 60000,     // How long a session can be inactive before cleanup
  MIN_AUDIO_SIZE_BYTES: 2000,    // Minimum audio chunk size to process
  MAX_AUDIO_BUFFER_BYTES: 640000, // ~5 seconds at 128kbps
  LOG_PREFIX: '[StreamingAudioProcessor]' // Prefix for all logs from this module
};

/**
 * Handles the initial processing of incoming audio stream chunks
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
    
    // Initialize session or add to existing session
    handleSessionInitialization(sessionId, language, audioBuffer, isFirstChunk);
    
    // Process if not already processing
    scheduleAudioProcessing(ws, sessionId);
  } catch (error) {
    console.error(`${CONFIG.LOG_PREFIX} Error processing streaming audio:`, error);
    WebSocketCommunicator.sendErrorMessage(ws, 'Failed to process audio data', 'server_error');
  }
}

/**
 * Handles session initialization or updates
 */
function handleSessionInitialization(
  sessionId: string, 
  language: string, 
  audioBuffer: Buffer, 
  isFirstChunk: boolean
): void {
  // Initialize session if it's the first chunk or doesn't exist
  if (isFirstChunk || !sessionManager.getSession(sessionId)) {
    sessionManager.createSession(sessionId, language, audioBuffer);
  } else {
    // Add to existing session
    sessionManager.addAudioToSession(sessionId, audioBuffer);
  }
}

/**
 * Schedules audio processing if not already in progress
 */
function scheduleAudioProcessing(ws: WebSocket, sessionId: string): void {
  const session = sessionManager.getSession(sessionId);
  if (session && !session.transcriptionInProgress) {
    // Start processing in the background
    processAudioChunks(ws, sessionId).catch(error => {
      console.error(`${CONFIG.LOG_PREFIX} Error processing audio chunks:`, error);
      WebSocketCommunicator.sendErrorMessage(ws, 'Error processing audio stream', 'server_error');
    });
  }
}

/**
 * Process accumulated audio chunks for a session
 */
export async function processAudioChunks(ws: WebSocket, sessionId: string): Promise<void> {
  // Early return if session doesn't exist or has no audio
  const session = sessionManager.getSession(sessionId);
  if (!session || session.audioBuffer.length === 0) return;
  
  // Mark as processing to prevent concurrent processing
  sessionManager.setTranscriptionInProgress(sessionId, true);
  
  try {
    // Combine and manage audio buffers
    const combinedBuffer = combineAndManageAudioBuffers(sessionId);
    
    // Skip processing if buffer is too small
    if (combinedBuffer.length < CONFIG.MIN_AUDIO_SIZE_BYTES) {
      sessionManager.setTranscriptionInProgress(sessionId, false);
      return;
    }
    
    // Process the audio and send results
    await transcribeAndSendResults(ws, sessionId, combinedBuffer, session);
  } catch (error) {
    handleProcessingError(ws, error);
  } finally {
    // Mark as done processing
    const sessionAfterProcessing = sessionManager.getSession(sessionId);
    if (sessionAfterProcessing) {
      sessionManager.setTranscriptionInProgress(sessionId, false);
    }
  }
}

/**
 * Combines audio buffers and manages buffer size
 */
function combineAndManageAudioBuffers(sessionId: string): Buffer {
  const session = sessionManager.getSession(sessionId);
  if (!session || session.audioBuffer.length === 0) {
    return Buffer.alloc(0);
  }
  
  // Create a single buffer from all chunks
  const combinedBuffer = Buffer.concat(session.audioBuffer);
  
  // Manage buffer size to maintain context but reduce processing load
  if (combinedBuffer.length > CONFIG.MAX_AUDIO_BUFFER_BYTES) {
    // Keep only the most recent audio
    const truncatedBuffer = combinedBuffer.slice(-CONFIG.MAX_AUDIO_BUFFER_BYTES);
    sessionManager.replaceSessionAudioBuffer(sessionId, truncatedBuffer);
  } else {
    // Clear processed audio chunks
    sessionManager.clearSessionAudioBuffer(sessionId);
  }
  
  return combinedBuffer;
}

/**
 * Transcribe audio and send results over WebSocket
 */
async function transcribeAndSendResults(
  ws: WebSocket, 
  sessionId: string, 
  audioBuffer: Buffer, 
  session: AudioStreamingSessionState
): Promise<void> {
  // Transcribe using our audio processing service
  const transcriptionText = await audioTranscriptionService.transcribeAudio(
    audioBuffer, 
    session.language
  );
  
  // Send result if we got meaningful text
  if (transcriptionText && transcriptionText.trim() !== '') {
    // Store the latest transcription for finalization
    sessionManager.updateSessionTranscription(sessionId, transcriptionText);
    
    // Send back transcription result
    WebSocketCommunicator.sendTranscriptionResult(ws, {
      text: transcriptionText,
      isFinal: false,
      languageCode: session.language
    });
  }
}

/**
 * Handle processing errors
 */
function handleProcessingError(ws: WebSocket, error: any): void {
  console.error(`${CONFIG.LOG_PREFIX} Error transcribing audio:`, error);
  WebSocketCommunicator.sendErrorMessage(ws, 'Failed to transcribe audio', 'transcription_error');
}

/**
 * Finalize a streaming session
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
    await sendFinalTranscription(ws, session);
    
    // Clean up the session
    sessionManager.deleteSession(sessionId);
    console.log(`${CONFIG.LOG_PREFIX} Finalized and closed session: ${sessionId}`);
  } catch (error) {
    console.error(`${CONFIG.LOG_PREFIX} Error finalizing session:`, error);
  }
}

/**
 * Send final transcription result
 */
async function sendFinalTranscription(ws: WebSocket, session: AudioStreamingSessionState): Promise<void> {
  WebSocketCommunicator.sendTranscriptionResult(ws, {
    text: session.transcriptionText,
    isFinal: true,
    languageCode: session.language
  });
}

/**
 * Clean up inactive streaming sessions
 */
export function cleanupInactiveStreamingSessions(maxAgeMs: number = CONFIG.SESSION_MAX_AGE_MS): void {
  sessionManager.cleanupInactiveSessions(maxAgeMs);
}

// Set up a periodic cleanup task
setInterval(() => {
  cleanupInactiveStreamingSessions();
}, CONFIG.CLEANUP_INTERVAL_MS);