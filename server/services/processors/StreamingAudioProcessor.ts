import { sessionManager } from '../managers/AudioSessionManager';
import { audioTranscriptionService, WebSocketCommunicator } from '../transcription/AudioTranscriptionService';
import { WebSocket as NodeWebSocket } from 'ws';

/**
 * Process a chunk of streaming audio
 * @param ws The WebSocket connection to send results to
 * @param sessionId The ID of the session
 * @param audioBase64 The audio data chunk in base64 format
 * @param isFirstChunk Whether this is the first chunk of the session
 * @param language The language code for transcription
 */
export async function processStreamingAudio(
  ws: NodeWebSocket,
  sessionId: string,
  audioBase64: string,
  isFirstChunk: boolean,
  language: string = 'en-US'
) {
  try {
    // Safety checks for WebSocket ready state
    if (ws.readyState !== 1) { // 1 = OPEN
      console.log(`WebSocket not open for session ${sessionId}, state: ${ws.readyState}`);
      return;
    }
    
    // Convert base64 to Buffer
    let audioChunk: Buffer;
    try {
      audioChunk = Buffer.from(audioBase64, 'base64');
    } catch (conversionError) {
      console.error('Error converting base64 to buffer:', conversionError);
      WebSocketCommunicator.sendErrorMessage(ws, 'Invalid audio format');
      return;
    }
    
    // Check if session exists
    const session = sessionManager.getSession(sessionId);
    
    if (!session || isFirstChunk) {
      // Create a new session if it doesn't exist or this is explicitly the first chunk
      console.log(`Created new session: ${sessionId}, language: ${language}`);
      sessionManager.createSession(sessionId, language, audioChunk);
    } else {
      // Add to existing session
      sessionManager.addAudioToSession(sessionId, audioChunk);
      
      // Only attempt transcription if session isn't already processing
      if (!session.transcriptionInProgress && session.audioBuffer.length > 1) {
        console.log(`Processing audio for session: ${sessionId}`);
        // Process accumulated audio chunks here (implementation details)
      }
    }
  } catch (error) {
    console.error('Error processing streaming audio:', error);
    WebSocketCommunicator.sendErrorMessage(ws, 'Error processing audio chunk');
  }
}

/**
 * Finalize a streaming session, processing any remaining audio
 * @param ws The WebSocket connection to send results to
 * @param sessionId The ID of the session to finalize
 */
export async function finalizeStreamingSession(
  ws: NodeWebSocket,
  sessionId: string
) {
  try {
    const session = sessionManager.getSession(sessionId);
    
    if (!session) {
      console.log(`No session found for ID: ${sessionId}`);
      return;
    }
    
    console.log(`Finalizing session: ${sessionId}`);
    
    try {
      // If there's audio in the buffer, process it
      if (session.audioBuffer.length > 0) {
        // Combine all buffers
        const combinedBuffer = Buffer.concat(session.audioBuffer);
        
        // Get final transcription
        try {
          const transcription = await audioTranscriptionService.transcribeAudio(
            combinedBuffer,
            session.language
          );
          
          // Update session with final transcription
          sessionManager.updateSessionTranscription(sessionId, transcription);
        } catch (processingError) {
          console.error('Error processing final audio chunk:', processingError);
        }
      }
      
      // Send final transcription result
      if (ws.readyState === 1) { // OPEN
        WebSocketCommunicator.sendTranscriptionResult(ws, {
          text: session.transcriptionText,
          isFinal: true,
          languageCode: session.language
        });
      }
      
      // Delete the session
      sessionManager.deleteSession(sessionId);
      console.log(`Finalized and closed session: ${sessionId}`);
    } catch (error) {
      console.error('Error finalizing session:', error);
      
      // Still try to send final result and delete session to prevent leaks
      if (ws.readyState === 1) { // OPEN
        WebSocketCommunicator.sendTranscriptionResult(ws, {
          text: session.transcriptionText || '',
          isFinal: true,
          languageCode: session.language
        });
      }
      
      sessionManager.deleteSession(sessionId);
    }
  } catch (finalError) {
    console.error('Error finalizing session:', finalError);
  }
}

/**
 * Clean up inactive streaming sessions
 * @param maxAgeMs Maximum age in milliseconds for inactive sessions
 */
export function cleanupInactiveStreamingSessions(maxAgeMs: number = 30000) {
  sessionManager.cleanupInactiveSessions(maxAgeMs);
  console.log(`Cleaning up inactive sessions older than ${maxAgeMs}ms`);
}