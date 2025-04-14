import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import { translateSpeech } from './openai';
import { storage } from './storage';

// Map to store active connections by user role and language preference
interface UserConnection {
  ws: WebSocket;
  role: 'teacher' | 'student';
  languageCode: string;
  sessionId: string;
}

export class TranslationWebSocketServer {
  private wss: WebSocketServer;
  private connections: Map<WebSocket, UserConnection> = new Map();
  private sessionCounter: number = 0;

  constructor(server: Server) {
    this.wss = new WebSocketServer({ server, path: '/ws' });
    
    // Clear any existing connections before initializing
    this.connections = new Map();
    this.sessionCounter = 0;
    
    this.initialize();
  }

  private initialize() {
    this.wss.on('connection', (ws, req) => {
      // Log detailed information about the connection request
      console.log(`New WebSocket connection from ${req.socket.remoteAddress}, path: ${req.url}`);
      console.log(`Headers: ${JSON.stringify(req.headers, null, 2)}`);
      
      // Create a session ID for this connection
      const sessionId = `session_${Date.now()}_${this.sessionCounter++}`;
      
      // Extract role and language info from query parameters if available
      // This allows setting the role immediately on connection
      let initialRole: 'teacher' | 'student' = 'student';
      let initialLanguage = 'en-US';
      
      try {
        if (req.url) {
          const urlParts = req.url.split('?');
          if (urlParts.length > 1) {
            const params = new URLSearchParams(urlParts[1]);
            if (params.get('role') === 'teacher') {
              initialRole = 'teacher';
              console.log(`Setting initial role to 'teacher' from URL query parameter`);
            }
            if (params.get('language')) {
              initialLanguage = params.get('language') as string;
            }
          }
        }
      } catch (error) {
        console.error('Error parsing URL query parameters:', error);
      }
      
      // Initialize connection with values
      const connection: UserConnection = {
        ws,
        role: initialRole,
        languageCode: initialLanguage,
        sessionId
      };
      
      this.connections.set(ws, connection);
      
      // Send confirmation to client with role information
      try {
        console.log(`Sending connection confirmation with sessionId: ${sessionId}`);
        ws.send(JSON.stringify({
          type: 'connection',
          status: 'connected',
          sessionId,
          role: initialRole,
          languageCode: initialLanguage
        }));
        console.log('Connection confirmation sent successfully');
      } catch (err) {
        console.error('Failed to send connection confirmation:', err);
      }

      // Handle messages from clients
      ws.on('message', async (message) => {
        try {
          console.log(`Received message from client, length: ${message.toString().length}`);
          const data = JSON.parse(message.toString());
          console.log(`Parsed message type: ${data.type}`);
          await this.handleMessage(ws, data);
        } catch (error) {
          console.error('Error handling message:', error);
          try {
            ws.send(JSON.stringify({ 
              type: 'error', 
              error: 'Invalid message format'
            }));
          } catch (sendError) {
            console.error('Error sending error message to client:', sendError);
          }
        }
      });

      // Handle connection close
      ws.on('close', (code, reason) => {
        const connection = this.connections.get(ws);
        console.log(`WebSocket connection closed - Code: ${code}, Reason: ${reason ? reason.toString() : 'No reason provided'}`);
        console.log(`Connection details - Role: ${connection?.role}, Language: ${connection?.languageCode}, Session: ${connection?.sessionId}`);
        this.connections.delete(ws);
        
        // Log current connection stats
        const stats = this.getStats();
        console.log(`Remaining connections: ${stats.totalConnections} (Teachers: ${stats.teacherCount}, Students: ${stats.studentCount})`);
      });

      // Log any errors
      ws.on('error', (error) => {
        console.error('WebSocket connection error:', error);
      });

      // Connection confirmation was already sent above, no need to send it again
    });
    
    // Log any server-level errors
    this.wss.on('error', (error) => {
      console.error('WebSocket server error:', error);
    });
    
    console.log(`WebSocket server initialized and listening on path: ${this.wss.options.path}`);
  }

  private async handleMessage(ws: WebSocket, data: any) {
    const connection = this.connections.get(ws);
    if (!connection) {
      console.error('Received message from unknown connection!');
      return;
    }

    const { type, payload } = data;
    
    // Debug current connection state
    console.log(`Processing message type=${type} from connection: role=${connection.role}, languageCode=${connection.languageCode}`);
    

    switch (type) {
      case 'register':
        // Update connection info
        if (payload.role) {
          console.log(`Changing connection role from ${connection.role} to ${payload.role}`);
          connection.role = payload.role;
        }
        if (payload.languageCode) connection.languageCode = payload.languageCode;
        
        // Update the server-side connection record
        this.connections.set(ws, connection);
        
        console.log(`Updated connection: role=${connection.role}, languageCode=${connection.languageCode}`);
        
        ws.send(JSON.stringify({ 
          type: 'register', 
          status: 'success',
          data: { role: connection.role, languageCode: connection.languageCode }
        }));
        break;

      case 'audio':
        // Check if role is in payload and use it to validate or correct server-side role
        if (payload.role === 'teacher' && connection.role !== 'teacher') {
          console.log(`CRITICAL: Found role mismatch! Payload has teacher but connection has ${connection.role}. Fixing...`);
          connection.role = 'teacher';
          this.connections.set(ws, connection);
        }
        
        // Process audio from teacher and broadcast translations
        const effectiveRole = payload.role || connection.role;
        
        if ((effectiveRole === 'teacher' || connection.role === 'teacher') && payload.audio) {
          console.log(`Received audio message from teacher (effectiveRole=${effectiveRole}, connectionRole=${connection.role}), data length: ${payload.audio.length}`);
          try {
            await this.processAndBroadcastAudio(connection, payload.audio);
          } catch (err) {
            console.error('Error in processAndBroadcastAudio:', err);
            // Try to notify teacher about the error
            try {
              if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({
                  type: 'error',
                  error: 'Failed to process audio: ' + (err instanceof Error ? err.message : String(err))
                }));
              }
            } catch (sendErr) {
              console.error('Failed to send error message to client:', sendErr);
            }
          }
        } else {
          console.log(`Received audio message but conditions not met:`, 
            `role=${connection.role}`, 
            `hasAudio=${!!payload.audio}`,
            `audioLength=${payload.audio ? payload.audio.length : 0}`);
        }
        break;

      case 'transcript_request':
        // Send transcript history for the requested language
        if (connection.role === 'student' && payload.sessionId && payload.languageCode) {
          const transcripts = await storage.getTranscriptsBySession(
            payload.sessionId,
            payload.languageCode
          );
          
          ws.send(JSON.stringify({
            type: 'transcript_history',
            data: transcripts
          }));
        }
        break;

      default:
        ws.send(JSON.stringify({ 
          type: 'error', 
          error: 'Unknown message type' 
        }));
    }
  }

  private async processAndBroadcastAudio(teacherConnection: UserConnection, audioBase64: string) {
    try {
      // Validate the audio data
      if (!audioBase64 || audioBase64.length < 100) {
        console.log('Received invalid or too small audio data (length: ' + (audioBase64 ? audioBase64.length : 0) + ')');
        this.sendProcessingComplete(teacherConnection, [teacherConnection.languageCode]);
        return; // Exit early instead of throwing an error
      }
      
      console.log(`Processing audio data (length: ${audioBase64.length}) from teacher...`);
      
      // Convert base64 audio to buffer
      const audioBuffer = Buffer.from(audioBase64, 'base64');
      console.log(`Converted audio data to buffer (size: ${audioBuffer.byteLength})`);
      
      // Add WAV header if missing (browser's MediaRecorder typically sends raw audio data)
      let processedBuffer = audioBuffer;
      
      // Check if the buffer already has a WAV header (should start with "RIFF")
      const hasWavHeader = audioBuffer.length > 4 && 
                           audioBuffer[0] === 0x52 && // R
                           audioBuffer[1] === 0x49 && // I
                           audioBuffer[2] === 0x46 && // F
                           audioBuffer[3] === 0x46;   // F
      
      if (!hasWavHeader) {
        console.log('Audio data does not have WAV header, adding one...');
        // This is a simplified WAV header for 16-bit mono PCM at 44.1kHz
        // In a production app, we would create a proper header based on the actual audio format
        const header = Buffer.from([
          0x52, 0x49, 0x46, 0x46, // "RIFF"
          0x24, 0x00, 0x00, 0x00, // Chunk size (placeholder)
          0x57, 0x41, 0x56, 0x45, // "WAVE"
          0x66, 0x6d, 0x74, 0x20, // "fmt "
          0x10, 0x00, 0x00, 0x00, // Format chunk size (16)
          0x01, 0x00,             // Format tag (1 = PCM)
          0x01, 0x00,             // Channels (1 = mono)
          0x44, 0xac, 0x00, 0x00, // Sample rate (44100)
          0x88, 0x58, 0x01, 0x00, // Bytes per second (44100*2)
          0x02, 0x00,             // Block align (2 bytes per sample)
          0x10, 0x00,             // Bits per sample (16)
          0x64, 0x61, 0x74, 0x61, // "data"
          0x00, 0x00, 0x00, 0x00  // Data size (placeholder)
        ]);
        
        // Update chunk size (file size - 8)
        const fileSize = header.length + audioBuffer.length - 8;
        header.writeUInt32LE(fileSize, 4);
        
        // Update data size
        header.writeUInt32LE(audioBuffer.length, 40);
        
        // Combine header and audio data
        processedBuffer = Buffer.concat([header, audioBuffer]);
        console.log(`Added WAV header, new buffer size: ${processedBuffer.byteLength}`);
      }
      
      const sourceLanguage = teacherConnection.languageCode;
      const sessionId = teacherConnection.sessionId;
      
      // Check if OpenAI API key is available
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        console.error('ERROR: OpenAI API key is not set. Please set the OPENAI_API_KEY environment variable.');
        throw new Error('OpenAI API key is not set');
      } else {
        console.log('OpenAI API key is available (length:', apiKey.length, ')');
      }
      
      // Get all unique target languages from student connections
      const targetLanguages = new Set<string>();
      // Use Array.from to convert iterator to array first to avoid TS downlevelIteration error
      Array.from(this.connections.values()).forEach(conn => {
        if (conn.role === 'student' && conn.languageCode !== sourceLanguage) {
          targetLanguages.add(conn.languageCode);
        }
      });

      // Track processing times for latency calculation
      const startTime = Date.now();
      
      // Process translation for each target language
      console.log(`Processing translations for ${targetLanguages.size} target languages: ${Array.from(targetLanguages).join(', ')}`);
      
      if (targetLanguages.size === 0) {
        console.log('No students connected with different languages, processing source language only');
        // Add the source language if there are no students yet
        targetLanguages.add(sourceLanguage);
      }

      // Process each language separately and handle errors independently
      // Use Array.from to convert Set iterator to array to avoid TS downlevelIteration error
      for (const targetLanguage of Array.from(targetLanguages)) {
        console.log(`Translating from ${sourceLanguage} to ${targetLanguage}...`);
        
        try {
          // Use the processed buffer with WAV header for the OpenAI API
          const result = await translateSpeech(processedBuffer, sourceLanguage, targetLanguage);
          
          // Skip empty translations (likely from short audio chunks)
          if (!result.originalText && !result.translatedText) {
            console.log('Empty transcription result, skipping translation broadcasting');
            this.sendProcessingComplete(teacherConnection, [targetLanguage]);
            continue; // Skip to the next language
          }
          
          console.log(`Translation complete: "${result.originalText}" -> "${result.translatedText}"`);
          
          // Calculate latency
          const latency = Date.now() - startTime;
        
          // Store translation and transcript
          await storage.addTranslation({
            sourceLanguage,
            targetLanguage,
            originalText: result.originalText,
            translatedText: result.translatedText,
            latency
          });
          
          await storage.addTranscript({
            sessionId,
            language: targetLanguage,
            text: result.translatedText
          });
          
          // Broadcast to students who selected this language AND ALSO to the teacher
          // Use Array.from to convert entries iterator to array to avoid TS downlevelIteration error
          for (const [ws, conn] of Array.from(this.connections.entries())) {
            if (
              (conn.role === 'student' && conn.languageCode === targetLanguage ||
               conn.role === 'teacher' && conn.sessionId === sessionId) &&
              ws.readyState === WebSocket.OPEN
            ) {
              ws.send(JSON.stringify({
                type: 'translation',
                data: {
                  sessionId,
                  sourceLanguage,
                  targetLanguage,
                  originalText: result.originalText,
                  translatedText: result.translatedText,
                  audio: result.audioBuffer.toString('base64'),
                  timestamp: new Date().toISOString(),
                  latency
                }
              }));
              console.log(`Sent translation to ${conn.role} with language ${conn.languageCode}`);
            }
          }
        } catch (error) {
          console.error(`Error processing translation from ${sourceLanguage} to ${targetLanguage}:`, error);
        }
      }
      
      // Also send back confirmation to the teacher with role verification
      if (teacherConnection.ws.readyState === WebSocket.OPEN) {
        teacherConnection.ws.send(JSON.stringify({
          type: 'processing_complete',
          data: {
            timestamp: new Date().toISOString(),
            targetLanguages: Array.from(targetLanguages),
            latency: Date.now() - startTime,
            role: teacherConnection.role,  // Return the role for verification
            roleConfirmed: true  // Explicitly confirm the teacher role is set correctly
          }
        }));
      }
    } catch (error) {
      console.error('Error processing audio:', error);
      
      // Notify teacher of error
      if (teacherConnection.ws.readyState === WebSocket.OPEN) {
        teacherConnection.ws.send(JSON.stringify({
          type: 'error',
          error: 'Failed to process audio for translation'
        }));
      }
    }
  }

  // Helper method to send processing complete notification
  private sendProcessingComplete(teacherConnection: UserConnection, targetLanguages: string[]) {
    if (teacherConnection.ws.readyState === WebSocket.OPEN) {
      teacherConnection.ws.send(JSON.stringify({
        type: 'processing_complete',
        data: {
          timestamp: new Date().toISOString(),
          targetLanguages,
          latency: 0,
          role: teacherConnection.role,
          roleConfirmed: true
        }
      }));
    }
  }

  // Get statistics about current connections
  public getStats() {
    const teacherCount = Array.from(this.connections.values())
      .filter(conn => conn.role === 'teacher').length;
    
    const studentCount = Array.from(this.connections.values())
      .filter(conn => conn.role === 'student').length;
    
    const languageCounts = Array.from(this.connections.values())
      .reduce((acc, conn) => {
        acc[conn.languageCode] = (acc[conn.languageCode] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
    
    return {
      totalConnections: this.connections.size,
      teacherCount,
      studentCount,
      languageCounts
    };
  }
}