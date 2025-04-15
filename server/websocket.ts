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
  lastActivity: number; // Timestamp to track last client activity
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
        sessionId,
        lastActivity: Date.now() // Initialize activity timestamp
      };
      
      this.connections.set(ws, connection);
      
      // lastActivity already initialized in the connection object
      
      // Set up server-side ping interval to keep connection alive
      const pingInterval = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          // Check if client has been inactive for too long (30 seconds)
          const now = Date.now();
          const inactiveTime = now - (connection.lastActivity || now);
          
          if (inactiveTime > 30000) {
            console.warn(`Connection ${sessionId} has been inactive for ${inactiveTime}ms, closing connection`);
            try {
              ws.close(1000, "Inactivity timeout");
              clearInterval(pingInterval);
              return;
            } catch (err) {
              console.error('Error closing inactive connection:', err);
            }
          }
          
          try {
            console.log(`Sending server-initiated ping to connection ${sessionId}`);
            ws.send(JSON.stringify({
              type: 'ping',
              timestamp: now
            }));
          } catch (error) {
            console.error('Error sending server ping:', error);
            clearInterval(pingInterval);
          }
        } else {
          console.log(`Connection ${sessionId} is no longer open (readyState=${ws.readyState}), stopping ping interval`);
          clearInterval(pingInterval);
        }
      }, 5000); // Send ping every 5 seconds (reduced from 15 seconds)
      
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

      // Create a tracking variable for the ping interval
      const pingIntervalRef = { interval: pingInterval };
      
      // Store the ping interval reference on the ws object for cleanup
      (ws as any)._pingInterval = pingIntervalRef;
      
      // Handle connection close
      ws.on('close', (code, reason) => {
        const connection = this.connections.get(ws);
        console.log(`WebSocket connection closed - Code: ${code}, Reason: ${reason ? reason.toString() : 'No reason provided'}`);
        console.log(`Connection details - Role: ${connection?.role}, Language: ${connection?.languageCode}, Session: ${connection?.sessionId}`);
        
        // Clean up the ping interval
        if ((ws as any)._pingInterval?.interval) {
          clearInterval((ws as any)._pingInterval.interval);
          console.log(`Cleared ping interval for connection ${connection?.sessionId}`);
        }
        
        // Remove from connections map
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
      case 'ping':
        // Respond to ping messages to keep the connection alive
        if (ws.readyState === WebSocket.OPEN) {
          console.log('Received ping from client');
          try {
            // Update the last activity time to prevent server-side ping timeouts
            connection.lastActivity = Date.now();
            
            // Send pong response immediately
            ws.send(JSON.stringify({
              type: 'pong',
              timestamp: Date.now()
            }));
            console.log('Sent pong response to client ping');
          } catch (error) {
            console.error('Error sending pong response:', error);
          }
        }
        break;
        
      case 'pong':
        // Client responded to our ping, update activity time
        if (ws.readyState === WebSocket.OPEN) {
          console.log('Received pong from client, updating activity timestamp');
          connection.lastActivity = Date.now();
        }
        break;
        
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
        
      case 'transcription':
        // Handle direct text transcription from Web Speech API
        if (connection.role !== 'teacher') {
          console.warn('Received transcription message from non-teacher role:', connection.role);
          // Only teachers are allowed to send transcriptions
          break;
        }
        
        if (!payload.text || typeof payload.text !== 'string') {
          console.warn('Received transcription message with invalid text:', payload.text);
          break;
        }
        
        console.log(`Received Web Speech API transcription: "${payload.text.substring(0, 100)}${payload.text.length > 100 ? '...' : ''}"`);
        
        // Get list of target languages (include the source language for recording)
        const targetLanguages = Array.from(this.connections.values())
          .filter(conn => conn.role === 'student' || conn.sessionId === connection.sessionId)
          .map(conn => conn.languageCode)
          .filter((lang, index, self) => self.indexOf(lang) === index); // Unique languages
          
        console.log(`Translating to ${targetLanguages.length} languages:`, targetLanguages);
        
        // Process transcription and translate to all required languages
        targetLanguages.forEach(async (targetLanguage) => {
          try {
            if (targetLanguage === connection.languageCode) {
              // If target language is the same as source, no translation needed
              this.broadcastTranslation(
                connection,
                payload.text,
                payload.text, // Same text for source & target
                connection.languageCode,
                targetLanguage
              );
            } else {
              // Translate to target language using OpenAI
              const { originalText, translatedText } = await translateSpeech(
                Buffer.from(''), // Empty buffer since we're using pre-transcribed text
                connection.languageCode,
                targetLanguage,
                payload.text // Pass the transcribed text from Web Speech API
              );
              
              // Broadcast the translation to clients
              this.broadcastTranslation(
                connection,
                originalText,
                translatedText,
                connection.languageCode,
                targetLanguage
              );
            }
          } catch (error) {
            console.error(`Error translating from ${connection.languageCode} to ${targetLanguage}:`, error);
          }
        });
        
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

  // Store audio chunks by connection and session for potential combining
  private audioChunks: Map<string, Buffer[]> = new Map();
  private lastChunkTime: Map<string, number> = new Map();
  private minimumBufferSize = 30000; // Minimum buffer size for reliable transcription
  
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
      const hasWavHeader = this.hasWavHeader(audioBuffer);
      
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
      
      // Get or create a unique key for this connection
      const connectionKey = `${teacherConnection.role}_${teacherConnection.sessionId}`;
      
      // Initialize audio chunks collection if it doesn't exist
      if (!this.audioChunks.has(connectionKey)) {
        this.audioChunks.set(connectionKey, []);
        this.lastChunkTime.set(connectionKey, Date.now());
      }
      
      // Get the current audio chunks for this connection
      const chunks = this.audioChunks.get(connectionKey) || [];
      const currentTime = Date.now();
      const lastTime = this.lastChunkTime.get(connectionKey) || 0;
      const timeSinceLastChunk = currentTime - lastTime;
      
      // Update the last chunk time
      this.lastChunkTime.set(connectionKey, currentTime);
      
      // Add current audio buffer to chunks
      chunks.push(processedBuffer);
      
      // Limit the number of stored chunks to prevent memory issues (keep last 10)
      if (chunks.length > 10) {
        chunks.shift();
      }
      
      // Update the stored chunks
      this.audioChunks.set(connectionKey, chunks);
      
      // Determine if we should process now or wait for more chunks
      let shouldProcess = false;
      
      // Process if this chunk is large enough by itself
      if (processedBuffer.byteLength >= this.minimumBufferSize) {
        console.log(`Audio chunk is large enough (${processedBuffer.byteLength} bytes), processing immediately`);
        shouldProcess = true;
      }
      // Process if we have multiple chunks and long time since last chunk
      else if (chunks.length > 1 && timeSinceLastChunk > 1000) {
        console.log(`Processing ${chunks.length} chunks after ${timeSinceLastChunk}ms of silence`);
        shouldProcess = true;
      }
      // Process if total accumulated audio is large enough
      else if (chunks.length > 1) {
        const totalSize = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
        if (totalSize >= this.minimumBufferSize) {
          console.log(`Accumulated ${chunks.length} chunks with total size ${totalSize} bytes, processing now`);
          shouldProcess = true;
        }
      }
      
      // If we need more data, just store this chunk and finish
      if (!shouldProcess) {
        console.log(`Audio chunk small (${processedBuffer.byteLength} bytes), waiting for more chunks. Total chunks: ${chunks.length}`);
        this.sendProcessingComplete(teacherConnection, [teacherConnection.languageCode]);
        return;
      }
      
      // Combine all chunks if there are multiple
      if (chunks.length > 1) {
        // Get all PCM data from the chunks
        const dataChunks = [];
        let totalLength = 0;
        
        // For the first chunk, keep the entire WAV file (header + data)
        const firstChunk = chunks[0];
        dataChunks.push(firstChunk);
        totalLength += firstChunk.byteLength;
        
        // For subsequent chunks, extract only the PCM data (skip WAV header)
        for (let i = 1; i < chunks.length; i++) {
          const chunk = chunks[i];
          // Skip the 44-byte WAV header if it has one
          if (this.hasWavHeader(chunk) && chunk.byteLength > 44) {
            const audioData = chunk.subarray(44);
            dataChunks.push(audioData);
            totalLength += audioData.byteLength;
          } else {
            dataChunks.push(chunk);
            totalLength += chunk.byteLength;
          }
        }
        
        // Create a combined buffer
        processedBuffer = Buffer.concat(dataChunks, totalLength);
        
        // Update the WAV header for the combined data
        if (this.hasWavHeader(processedBuffer) && processedBuffer.byteLength > 44) {
          // Update chunk size (file size - 8)
          const fileSize = processedBuffer.byteLength - 8;
          processedBuffer.writeUInt32LE(fileSize, 4);
          
          // Update data size (file size - 44)
          const dataSize = processedBuffer.byteLength - 44;
          processedBuffer.writeUInt32LE(dataSize, 40);
        }
        
        console.log(`Combined ${chunks.length} chunks into buffer of size ${processedBuffer.byteLength} bytes`);
        
        // Detect potential test audio based on size patterns
        const isSuspiciousPattern = this.detectSuspiciousAudio(processedBuffer);
        if (isSuspiciousPattern) {
          console.warn('⚠️ DETECTED POTENTIAL TEST AUDIO: Audio with suspicious pattern detected');
          console.warn('This audio will be rejected as it appears to be test content');
          return false; // Skip processing this audio chunk
        }
        
        // Clear the chunks after processing
        this.audioChunks.set(connectionKey, []);
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
          
          // Skip empty translations (likely from short audio chunks or filtered content)
          if (!result.originalText && !result.translatedText) {
            console.log('Empty transcription result, skipping translation broadcasting');
            // Still send a notification to the client, but with a filtered flag
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
                    originalText: "",
                    translatedText: "",
                    filtered: true,  // Add this flag to indicate it was filtered
                    timestamp: new Date().toISOString(),
                    latency: Date.now() - startTime
                  }
                }));
                console.log(`Sent filtered content notification to ${conn.role} with language ${conn.languageCode}`);
              }
            }
            this.sendProcessingComplete(teacherConnection, [targetLanguage]);
            continue; // Skip to the next language
          }
          
          // Log detailed information about the transcription
          console.log(`TRANSCRIPTION DETAILS:`);
          console.log(`- Original text: "${result.originalText}"`);
          console.log(`- Translated text: "${result.translatedText}"`);
          console.log(`- Text length: ${result.translatedText?.length || 0} chars`);
          console.log(`- Source language: ${sourceLanguage}`);
          console.log(`- Target language: ${targetLanguage}`);
          console.log(`- Audio buffer length: ${result.audioBuffer?.length || 0} bytes`);
          
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
  
  /**
   * Broadcast a translation to appropriate clients
   * @param teacherConnection The teacher connection that sent the original message
   * @param originalText The original transcribed text
   * @param translatedText The translated text
   * @param sourceLanguage The source language
   * @param targetLanguage The target language
   */
  private broadcastTranslation(
    teacherConnection: UserConnection,
    originalText: string,
    translatedText: string,
    sourceLanguage: string,
    targetLanguage: string
  ): void {
    // Calculate broadcast timestamp
    const timestamp = new Date().toISOString();
    const sessionId = teacherConnection.sessionId;
    
    // Log the translation
    console.log(`Broadcasting translation from ${sourceLanguage} to ${targetLanguage}:`);
    console.log(`- Original: "${originalText}"`);
    console.log(`- Translated: "${translatedText}"`);
    
    // Track which connections received the translation
    let receivedCount = 0;
    
    // Broadcast to all applicable connections (teacher + students with matching language)
    for (const [ws, conn] of this.connections.entries()) {
      const isRelevantTeacher = conn.role === 'teacher' && conn.sessionId === sessionId;
      const isRelevantStudent = conn.role === 'student' && conn.languageCode === targetLanguage;
      
      if ((isRelevantTeacher || isRelevantStudent) && ws.readyState === WebSocket.OPEN) {
        try {
          // Send the translation
          ws.send(JSON.stringify({
            type: 'translation',
            data: {
              sessionId,
              sourceLanguage,
              targetLanguage,
              originalText,
              translatedText,
              timestamp
            }
          }));
          
          receivedCount++;
          
          console.log(`✓ Sent translation to ${conn.role} with language ${conn.languageCode}`);
        } catch (error) {
          console.error(`Error sending translation to ${conn.role}:`, error);
        }
      }
    }
    
    console.log(`Translation broadcasted to ${receivedCount} connection(s)`);
    
    // Also store the translation in the database via storage
    try {
      // Store translation record
      storage.addTranslation({
        sourceLanguage,
        targetLanguage,
        originalText,
        translatedText,
        latency: 0 // No latency data for direct transcription
      }).catch(err => console.error('Error storing translation:', err));
      
      // Store transcript record for the target language
      storage.addTranscript({
        sessionId,
        language: targetLanguage,
        text: translatedText
      }).catch(err => console.error('Error storing transcript:', err));
    } catch (error) {
      console.error('Error storing translation/transcript:', error);
    }
  }

  // Helper method to check if a buffer has a WAV header
  private hasWavHeader(buffer: Buffer): boolean {
    return buffer.length > 4 && 
           buffer[0] === 0x52 && // R
           buffer[1] === 0x49 && // I
           buffer[2] === 0x46 && // F
           buffer[3] === 0x46;   // F
  }
  
  // Helper method to detect suspicious audio patterns (likely test audio)
  private detectSuspiciousAudio(buffer: Buffer): boolean {
    // No reasonable audio would be this exact size - likely test audio
    const knownTestSizes = [16000, 32000, 44100, 48000, 88200, 96000];
    const exactSizeMatch = knownTestSizes.includes(buffer.byteLength);
    
    // Check for suspiciously perfect audio length
    const isPerfectLength = buffer.byteLength % 1000 === 0 && buffer.byteLength > 10000;
    
    // Check for repeating patterns often found in test audio
    const hasSuspiciousRepeatingPattern = this.detectRepeatingPatterns(buffer);
    
    // If any suspicious pattern is detected
    if (exactSizeMatch || isPerfectLength || hasSuspiciousRepeatingPattern) {
      console.warn('Suspicious audio pattern detected:');
      console.warn(`- Exact size match: ${exactSizeMatch}`);
      console.warn(`- Perfect length: ${isPerfectLength}`);
      console.warn(`- Repeating patterns: ${hasSuspiciousRepeatingPattern}`);
      return true;
    }
    
    return false;
  }
  
  // Helper to detect repeating patterns in audio data
  private detectRepeatingPatterns(buffer: Buffer): boolean {
    // Skip WAV header if present
    const audioData = this.hasWavHeader(buffer) ? buffer.subarray(44) : buffer;
    
    // Nothing to analyze
    if (audioData.length < 1000) return false;
    
    // Sample some points from the audio to check for patterns
    // This is a simplified approach that looks for exact repeating sequences
    const sampleSize = 100;
    const numSamples = 5;
    const startPositions = [0, Math.floor(audioData.length * 0.2), Math.floor(audioData.length * 0.4),
                           Math.floor(audioData.length * 0.6), Math.floor(audioData.length * 0.8)];
    
    // Get samples
    const samples: Buffer[] = [];
    for (const pos of startPositions) {
      if (pos + sampleSize <= audioData.length) {
        samples.push(audioData.subarray(pos, pos + sampleSize));
      }
    }
    
    // Compare samples for similarity (exact matches)
    let exactMatches = 0;
    for (let i = 0; i < samples.length; i++) {
      for (let j = i + 1; j < samples.length; j++) {
        if (samples[i].equals(samples[j])) {
          exactMatches++;
        }
      }
    }
    
    // If more than 2 pairs of samples match exactly, that's very suspicious
    return exactMatches > 2;
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