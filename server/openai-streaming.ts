import { WebSocket } from 'ws';
import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import { Readable } from 'stream';

// Initialize OpenAI client
let openaiClient: OpenAI | null = null;

/**
 * Get or create an OpenAI client instance
 */
function getOpenAIClient(): OpenAI {
  if (!openaiClient) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY environment variable is not set');
    }
    
    openaiClient = new OpenAI({
      apiKey: apiKey
    });
  }
  
  return openaiClient;
}

/**
 * Handle WebSocket connections for real-time audio streaming
 */
export function handleStreamingConnection(ws: WebSocket, req: any) {
  console.log('New streaming transcription connection');
  
  // Parse language from query parameters
  const url = new URL(req.url, `http://${req.headers.host}`);
  const language = url.searchParams.get('language') || 'en-US';
  
  // Get language code for OpenAI (just the first part)
  const languageCode = language.split('-')[0];
  
  console.log(`Streaming transcription language: ${language} (code: ${languageCode})`);
  
  // Track active stream
  let activeStream: any = null;
  
  // Client configuration
  let clientConfig = {
    language: languageCode,
    interimResults: true
  };
  
  // Handle WebSocket messages
  ws.on('message', async (message: Buffer) => {
    try {
      const msgData = JSON.parse(message.toString());
      
      switch (msgData.type) {
        case 'config':
          // Update client configuration
          clientConfig = {
            ...clientConfig,
            ...msgData
          };
          console.log('Updated streaming configuration:', clientConfig);
          break;
          
        case 'audio_data':
          // Process audio data
          const audioBase64 = msgData.data;
          const audioBuffer = Buffer.from(audioBase64, 'base64');
          
          // Call OpenAI API for streaming transcription
          await processAudioChunk(audioBuffer, ws, clientConfig);
          break;
          
        case 'end':
          // End the session
          if (activeStream) {
            try {
              // Close any active streams
              activeStream = null;
            } catch (error) {
              console.error('Error closing active stream:', error);
            }
          }
          break;
          
        default:
          console.warn('Unknown message type:', msgData.type);
      }
    } catch (error) {
      console.error('Error processing WebSocket message:', error);
      sendError(ws, 'Error processing message: ' + (error as Error).message);
    }
  });
  
  // Handle WebSocket close
  ws.on('close', () => {
    console.log('Streaming transcription connection closed');
    if (activeStream) {
      try {
        // Clean up any resources
        activeStream = null;
      } catch (error) {
        console.error('Error closing active stream on connection close:', error);
      }
    }
  });
  
  // Handle WebSocket errors
  ws.on('error', (error) => {
    console.error('Streaming transcription WebSocket error:', error);
  });
  
  // Send initial connection confirmation
  ws.send(JSON.stringify({
    type: 'connected',
    message: 'Streaming transcription service connected',
    language: language
  }));
  
  /**
   * Process an audio chunk and send results back to client
   */
  async function processAudioChunk(audioBuffer: Buffer, ws: WebSocket, config: any) {
    try {
      // Get OpenAI client
      const openai = getOpenAIClient();
      
      // Create temporary file from buffer 
      // (OpenAI API requires a file or readable stream)
      const tempFilePath = path.join(process.cwd(), 'temp-audio-chunk.webm');
      fs.writeFileSync(tempFilePath, audioBuffer);
      
      // Create readable stream from the temporary file
      const audioStream = fs.createReadStream(tempFilePath);
      
      // Note: In a production environment, we would use a proper streaming approach
      // without temporary files, but this is simplified for demonstration
      
      // Call OpenAI API for real-time transcription
      // Note: the newest OpenAI model is "gpt-4o" which was released May 13, 2024
      const transcription = await openai.audio.transcriptions.create({
        file: fs.createReadStream(tempFilePath),
        model: 'whisper-1',
        language: config.language,
        response_format: 'verbose_json',
        temperature: 0.2,
        prompt: 'This is speech from a classroom setting.'
      });
      
      // Clean up temporary file
      try { fs.unlinkSync(tempFilePath); } catch (e) { /* ignore cleanup errors */ }
      
      // Process results
      if (transcription && transcription.text) {
        // Send final result
        sendFinalResult(ws, transcription.text);
        
        // If we have segments and interim results are enabled, also send the first segment as interim
        if (config.interimResults && 
            transcription.segments && 
            Array.isArray(transcription.segments) && 
            transcription.segments.length > 0) {
          
          // Send the first segment as an interim result
          // In a real streaming API, we would get multiple interim results
          sendInterimResult(ws, transcription.segments[0].text);
        }
      }
    } catch (error) {
      console.error('Error processing audio chunk:', error);
      sendError(ws, 'Error processing audio: ' + (error as Error).message);
    }
  }
  
  /**
   * Send an interim (partial) result
   */
  function sendInterimResult(ws: WebSocket, text: string) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'interim_result',
        text: text,
        confidence: 0.7
      }));
    }
  }
  
  /**
   * Send a final result
   */
  function sendFinalResult(ws: WebSocket, text: string) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'final_result',
        text: text,
        confidence: 0.9
      }));
    }
  }
  
  /**
   * Send an error message
   */
  function sendError(ws: WebSocket, errorMessage: string) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'error',
        error: errorMessage
      }));
    }
  }
}