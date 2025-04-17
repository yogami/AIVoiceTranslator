import OpenAI from 'openai';
import WebSocket from 'ws';

// Log API key status (masked for security)
console.log(`OpenAI Streaming - API key status: ${process.env.OPENAI_API_KEY ? 'Present' : 'Missing'}`);

// Initialize the OpenAI client with API key from environment
// Add fallback to avoid crashing the server if key is missing
let openai: OpenAI;
try {
  openai = new OpenAI({ 
    apiKey: process.env.OPENAI_API_KEY || 'sk-placeholder-for-initialization-only' 
  });
  console.log('OpenAI Streaming - client initialized successfully');
} catch (error) {
  console.error('OpenAI Streaming - Error initializing client:', error);
  // Create a placeholder client that will throw proper errors when methods are called
  openai = new OpenAI({ apiKey: 'sk-placeholder-for-initialization-only' });
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

// Map of active audio streaming sessions
const activeStreamingSessions = new Map<string, AudioStreamingSessionState>();

/**
 * Process streaming audio data from WebSocket
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
    if (isFirstChunk || !activeStreamingSessions.has(sessionId)) {
      console.log(`[OpenAI Streaming] Starting new streaming session: ${sessionId}, language: ${language}`);
      
      activeStreamingSessions.set(sessionId, {
        sessionId,
        language,
        isProcessing: false,
        audioBuffer: [audioBuffer],
        lastChunkTime: Date.now(),
        transcriptionText: '',
        transcriptionInProgress: false
      });
    } else {
      // Add to existing session
      const session = activeStreamingSessions.get(sessionId);
      if (session) {
        session.audioBuffer.push(audioBuffer);
        session.lastChunkTime = Date.now();
      }
    }
    
    // Process if we have enough audio data and not already processing
    const session = activeStreamingSessions.get(sessionId);
    if (session && !session.transcriptionInProgress) {
      // Start processing in the background
      processAudioChunks(ws, sessionId).catch(error => {
        console.error(`[OpenAI Streaming] Error processing audio chunks:`, error);
        sendTranscriptionError(ws, 'Error processing audio stream', 'server_error');
      });
    }
  } catch (error) {
    console.error('[OpenAI Streaming] Error processing streaming audio:', error);
    sendTranscriptionError(ws, 'Failed to process audio data', 'server_error');
  }
}

/**
 * Process accumulated audio chunks for a session
 * @param ws WebSocket connection
 * @param sessionId Session ID
 */
async function processAudioChunks(ws: WebSocket, sessionId: string): Promise<void> {
  const session = activeStreamingSessions.get(sessionId);
  if (!session || session.audioBuffer.length === 0) return;
  
  // Mark as processing to prevent concurrent processing
  session.transcriptionInProgress = true;
  
  try {
    // Create a single buffer from all chunks
    const combinedBuffer = Buffer.concat(session.audioBuffer);
    
    // Only keep the last ~5 seconds of audio to maintain context but reduce processing load
    // This is a balance between latency and accuracy
    const maxBufferSize = 5 * 128000; // ~5 seconds at 128kbps
    
    if (combinedBuffer.length > maxBufferSize) {
      // Clear buffer and keep only the most recent audio
      session.audioBuffer = [combinedBuffer.slice(-maxBufferSize)];
    } else {
      // Clear processed audio chunks
      session.audioBuffer = [];
    }
    
    // Skip processing if buffer is too small (avoid sending tiny chunks)
    if (combinedBuffer.length < 2000) {
      session.transcriptionInProgress = false;
      return;
    }
    
    // Create a blob for the OpenAI API
    const webmBlob = new Blob([combinedBuffer], { type: 'audio/webm' });
    
    // Convert Blob to File object
    const file = new File([webmBlob], 'audio.webm', { type: 'audio/webm' });
    
    // Transcribe using OpenAI API
    const formData = new FormData();
    formData.append('file', file);
    formData.append('model', 'whisper-1');
    formData.append('language', session.language.split('-')[0]); // OpenAI expects 'en' not 'en-US'
    formData.append('response_format', 'json');
    
    const transcription = await openai.audio.transcriptions.create({
      file: file,
      model: 'whisper-1',
      language: session.language.split('-')[0],
      response_format: 'json',
    });
    
    // Get the transcription text
    if (transcription.text && transcription.text.trim() !== '') {
      // Send back transcription result
      sendTranscriptionResult(ws, {
        text: transcription.text,
        isFinal: false,
        languageCode: session.language
      });
    }
  } catch (error) {
    console.error('[OpenAI Streaming] Error transcribing audio:', error);
    sendTranscriptionError(ws, 'Failed to transcribe audio', 'server_error');
  } finally {
    // Mark as done processing
    session.transcriptionInProgress = false;
  }
}

/**
 * Finalize a streaming session
 * @param ws WebSocket connection
 * @param sessionId Session ID
 */
export async function finalizeStreamingSession(ws: WebSocket, sessionId: string): Promise<void> {
  try {
    const session = activeStreamingSessions.get(sessionId);
    if (!session) return;
    
    // Process any remaining audio
    if (session.audioBuffer.length > 0) {
      await processAudioChunks(ws, sessionId);
    }
    
    // Send final transcription
    sendTranscriptionResult(ws, {
      text: session.transcriptionText,
      isFinal: true,
      languageCode: session.language
    });
    
    // Clean up the session
    activeStreamingSessions.delete(sessionId);
    console.log(`[OpenAI Streaming] Finalized and closed streaming session: ${sessionId}`);
  } catch (error) {
    console.error('[OpenAI Streaming] Error finalizing streaming session:', error);
  }
}

/**
 * Send a transcription result over WebSocket
 */
function sendTranscriptionResult(
  ws: WebSocket, 
  result: { text: string; isFinal: boolean; languageCode: string; confidence?: number }
): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({
      type: 'transcription',
      ...result
    }));
  }
}

/**
 * Send a transcription error over WebSocket
 */
function sendTranscriptionError(
  ws: WebSocket, 
  message: string, 
  errorType: string = 'server_error'
): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({
      type: 'error',
      message,
      errorType
    }));
  }
}

/**
 * Clean up inactive streaming sessions
 * This should be called periodically to prevent memory leaks
 */
export function cleanupInactiveStreamingSessions(maxAgeMs: number = 60000): void {
  const now = Date.now();
  
  // Use Array.from to convert Map entries to array first (avoids downlevelIteration error)
  for (const [sessionId, session] of Array.from(activeStreamingSessions.entries())) {
    const sessionAge = now - session.lastChunkTime;
    
    if (sessionAge > maxAgeMs) {
      console.log(`[OpenAI Streaming] Cleaning up inactive streaming session: ${sessionId}, age: ${sessionAge}ms`);
      activeStreamingSessions.delete(sessionId);
    }
  }
}

// Set up a cleanup interval
setInterval(() => {
  cleanupInactiveStreamingSessions();
}, 30000); // Check every 30 seconds