/**
 * WebSocket Server
 * 
 * Handles real-time communication between teacher and students
 */
import { Server } from 'http';
import { WebSocketServer as WSServer } from 'ws';
import { speechTranslationService } from './TranslationService';
import { URL } from 'url';

// Custom WebSocketClient type for our server
type WebSocketClient = WebSocket & {
  isAlive: boolean;
  sessionId: string;
  on: (event: string, listener: (...args: any[]) => void) => WebSocketClient;
  terminate: () => void;
  ping: () => void;
}

export class WebSocketServer {
  private wss: WSServer;
  // We use the speechTranslationService facade
  
  // Connection tracking
  private connections: Set<WebSocketClient> = new Set();
  private roles: Map<WebSocketClient, string> = new Map();
  private languages: Map<WebSocketClient, string> = new Map();
  private sessionIds: Map<WebSocketClient, string> = new Map();
  private clientSettings: Map<WebSocketClient, any> = new Map();
  
  // Stats
  private sessionCounter: number = 0;
  
  constructor(server: Server) {
    // Initialize WebSocket server with CORS settings
    this.wss = new WSServer({ 
      server,
      path: '/ws',
      // Add explicit CORS handling for WebSocket (following the Single Responsibility Principle)
      verifyClient: (info, callback) => {
        // Allow all origins for WebSocket connections
        console.log('WebSocket connection verification, headers:', JSON.stringify(info.req.headers, null, 2));
        callback(true); // Always accept the connection
      }
    });
    
    // We now use the imported speechTranslationService instead of creating a new instance
    
    // Set up event handlers
    this.setupEventHandlers();
    
    console.log('WebSocket server initialized and listening on path: /ws');
  }
  
  /**
   * Set up WebSocket server event handlers
   */
  private setupEventHandlers(): void {
    // Handle new connections
    this.wss.on('connection', (ws: WebSocket, request) => {
      // Cast WebSocket to our custom WebSocketClient type
      this.handleConnection(ws as unknown as WebSocketClient, request);
    });
    
    // Set up periodic ping to keep connections alive
    this.setupHeartbeat();
  }
  
  /**
   * Handle new WebSocket connection
   */
  private handleConnection(ws: WebSocketClient, request: any): void {
    try {
      // Log connection information
      console.log('New WebSocket connection from', request.socket.remoteAddress, 'path:', request.url);
      
      // Log headers for debugging
      console.log('Headers:', JSON.stringify(request.headers, null, 2));
      
      // Parse URL to get query parameters
      const url = new URL(request.url, `http://${request.headers.host}`);
      const role = url.searchParams.get('role');
      const language = url.searchParams.get('language');
      
      // Set initial role from URL if provided
      if (role) {
        console.log(`Setting initial role to '${role}' from URL query parameter`);
        this.roles.set(ws, role);
      }
      
      // Set initial language from URL if provided
      if (language) {
        this.languages.set(ws, language);
      }
      
      // Generate a unique session ID
      const sessionId = `session_${Date.now()}_${this.sessionCounter++}`;
      this.sessionIds.set(ws, sessionId);
      ws.sessionId = sessionId;
      
      // Add to connections set
      this.connections.add(ws);
      
      // Mark as alive for heartbeat
      ws.isAlive = true;
      
      // Set up message handler
      ws.on('message', (message: Buffer) => {
        this.handleMessage(ws, message.toString());
      });
      
      // Set up close handler
      ws.on('close', () => {
        this.handleClose(ws);
      });
      
      // Set up error handler
      ws.on('error', (error) => {
        console.error('WebSocket error:', error);
      });
      
      // Set up pong handler for heartbeat
      ws.on('pong', () => {
        ws.isAlive = true;
      });
      
      // Send connection confirmation
      this.sendConnectionConfirmation(ws);
    } catch (error) {
      console.error('Error handling new connection:', error);
    }
  }
  
  /**
   * Send connection confirmation to client
   */
  private sendConnectionConfirmation(ws: WebSocketClient): void {
    try {
      const sessionId = this.sessionIds.get(ws);
      const role = this.roles.get(ws);
      const language = this.languages.get(ws);
      
      const message = {
        type: 'connection',
        status: 'connected',
        sessionId,
        role,
        language
      };
      
      ws.send(JSON.stringify(message));
      console.log('Sending connection confirmation with sessionId:', sessionId);
      console.log('Connection confirmation sent successfully');
    } catch (error) {
      console.error('Error sending connection confirmation:', error);
    }
  }
  
  /**
   * Handle incoming WebSocket message
   */
  async handleMessage(ws: WebSocketClient, data: string): Promise<void> {
    try {
      // Parse message data
      const message = JSON.parse(data);
      
      // Process message based on type
      switch (message.type) {
        case 'register':
          this.handleRegisterMessage(ws, message);
          break;
        
        case 'transcription':
          await this.handleTranscriptionMessage(ws, message);
          break;
        
        case 'tts_request':
          await this.handleTTSRequestMessage(ws, message);
          break;
          
        case 'audio':
          await this.handleAudioMessage(ws, message);
          break;
          
        case 'ping':
          this.handlePingMessage(ws, message);
          break;
          
        case 'pong':
          // No specific handling needed
          break;
          
        default:
          console.warn('Unknown message type:', message.type);
      }
    } catch (error) {
      console.error('Error handling message:', error);
    }
  }
  
  /**
   * Handle registration message
   */
  private handleRegisterMessage(ws: WebSocketClient, message: any): void {
    console.log('Processing message type=register from connection:', 
      `role=${message.role}, languageCode=${message.languageCode}`);
    
    const currentRole = this.roles.get(ws);
    
    // Update role if provided
    if (message.role) {
      if (currentRole !== message.role) {
        console.log(`Changing connection role from ${currentRole} to ${message.role}`);
      }
      this.roles.set(ws, message.role);
    }
    
    // Update language if provided
    if (message.languageCode) {
      this.languages.set(ws, message.languageCode);
    }
    
    // Store client settings
    const settings: any = this.clientSettings.get(ws) || {};
    
    // Update text-to-speech service type if provided
    if (message.settings?.ttsServiceType) {
      settings.ttsServiceType = message.settings.ttsServiceType;
      console.log(`Client requested TTS service type: ${settings.ttsServiceType}`);
    }
    
    // Store updated settings
    this.clientSettings.set(ws, settings);
    
    console.log('Updated connection:', 
      `role=${this.roles.get(ws)}, languageCode=${this.languages.get(ws)}, ttsService=${settings.ttsServiceType || 'default'}`);
    
    // Send confirmation
    const response = {
      type: 'register',
      status: 'success',
      data: {
        role: this.roles.get(ws),
        languageCode: this.languages.get(ws),
        settings: settings
      }
    };
    
    ws.send(JSON.stringify(response));
  }
  
  /**
   * Handle transcription message
   */
  private async handleTranscriptionMessage(ws: WebSocketClient, message: any): Promise<void> {
    console.log('Received transcription from', this.roles.get(ws), ':', message.text);
    
    const role = this.roles.get(ws);
    const sessionId = this.sessionIds.get(ws);
    
    // Only process transcriptions from teacher
    if (role !== 'teacher') {
      console.warn('Ignoring transcription from non-teacher role:', role);
      return;
    }
    
    // Get all student connections
    const studentConnections: WebSocketClient[] = [];
    const studentLanguages: string[] = [];
    
    this.connections.forEach(client => {
      const clientRole = this.roles.get(client);
      const clientLanguage = this.languages.get(client);
      
      if (clientRole === 'student' && clientLanguage) {
        studentConnections.push(client);
        
        // Only add unique languages
        if (!studentLanguages.includes(clientLanguage)) {
          studentLanguages.push(clientLanguage);
        }
      }
    });
    
    if (studentConnections.length === 0) {
      console.log('No students connected, skipping translation');
      return;
    }
    
    // Translate text to all student languages
    const teacherLanguage = this.languages.get(ws) || 'en-US';
    
    // Using our new speechTranslationService to perform translations
    // This is a simplified implementation as we don't have translateTextToMultipleLanguages in the service
    const translations: Record<string, string> = {};
    
    // Translate for each language
    // Define a type for translation results that includes audioBuffer
    const translationResults: Record<string, { 
      originalText: string;
      translatedText: string;
      audioBuffer: Buffer;
    }> = {};
    
    for (const targetLanguage of studentLanguages) {
      try {
        // Get the client's preferred TTS service type
        let clientTtsServiceType = process.env.TTS_SERVICE_TYPE || 'browser';
        
        // Look for any students who speak this language and get their settings
        this.connections.forEach(client => {
          if (this.languages.get(client) === targetLanguage && 
              this.roles.get(client) === 'student' &&
              this.clientSettings.get(client)?.ttsServiceType) {
            // Use the first student's preference for this language
            clientTtsServiceType = this.clientSettings.get(client)?.ttsServiceType;
          }
        });
        
        // Set the TTS service type in the environment for this translation
        process.env.TTS_SERVICE_TYPE = clientTtsServiceType;
        console.log(`Using TTS service '${clientTtsServiceType}' for language '${targetLanguage}'`);
        
        // Perform the translation with the selected TTS service
        const result = await speechTranslationService.translateSpeech(
          Buffer.from(''), // Empty buffer as we already have the text
          teacherLanguage,
          targetLanguage,
          message.text // Use the pre-transcribed text
        );
        
        // Store the full result object for this language
        translationResults[targetLanguage] = result;
        
        // Also store just the text for backward compatibility
        translations[targetLanguage] = result.translatedText;
      } catch (error) {
        console.error(`Error translating to ${targetLanguage}:`, error);
        translations[targetLanguage] = message.text; // Fallback to original text
        translationResults[targetLanguage] = {
          originalText: message.text,
          translatedText: message.text,
          audioBuffer: Buffer.from('') // Empty buffer for fallback
        };
      }
    }
    
    // Send translations to students
    studentConnections.forEach(client => {
      const studentLanguage = this.languages.get(client);
      if (!studentLanguage) return;
      
      const translatedText = translations[studentLanguage] || message.text;
      
      // Get the TTS service type from the client's settings (if provided)
      const ttsServiceType = this.clientSettings.get(client)?.ttsServiceType || process.env.TTS_SERVICE_TYPE || 'browser';
      
      // Create translation message with audio data support
      const translationMessage: any = {
        type: 'translation',
        text: translatedText,
        originalText: message.text,
        sourceLanguage: teacherLanguage,
        targetLanguage: studentLanguage,
        ttsServiceType: ttsServiceType // Include the service type for client reference
      };
      
      // If we have a translation result with audio buffer, include it
      if (translationResults[studentLanguage] && translationResults[studentLanguage].audioBuffer) {
        try {
          const audioBuffer = translationResults[studentLanguage].audioBuffer;
          
          // Check if this is a special marker for browser speech synthesis
          const bufferStart = audioBuffer.toString('utf8', 0, Math.min(100, audioBuffer.length));
          
          if (bufferStart.startsWith('{"type":"browser-speech"')) {
            // This is a marker for browser-based speech synthesis
            translationMessage.useClientSpeech = true;
            try {
              translationMessage.speechParams = JSON.parse(bufferStart);
            } catch (jsonError) {
              console.error('Error parsing speech params:', jsonError);
              translationMessage.speechParams = {
                type: 'browser-speech',
                text: translatedText,
                languageCode: studentLanguage
              };
            }
          } else if (audioBuffer.length > 0) {
            // This is actual audio data - encode as base64
            translationMessage.audioData = audioBuffer.toString('base64');
          }
        } catch (error) {
          console.error('Error processing audio data for translation:', error);
        }
      }
      
      client.send(JSON.stringify(translationMessage));
    });
  }
  
  /**
   * Handle audio message
   */
  private async handleAudioMessage(ws: WebSocketClient, message: any): Promise<void> {
    const role = this.roles.get(ws);
    const sessionId = this.sessionIds.get(ws);
    
    console.log('Processing message type=audio from connection:', 
      `role=${role}, languageCode=${this.languages.get(ws)}`);
    
    if (role === 'teacher') {
      console.log('Processing teacher audio (detected from role info), data length:', message.data?.length);
      await this.processTeacherAudio(ws, message.data);
    } else {
      console.log('Ignoring audio from non-teacher role:', role);
    }
  }
  
  /**
   * Process audio from teacher
   */
  private async processTeacherAudio(ws: WebSocketClient, audioData: string): Promise<void> {
    if (!audioData || audioData.length < 100) {
      console.log('Received invalid or too small audio data (length:', audioData?.length, ')');
      return;
    }
    
    console.log('Processing audio data (length:', audioData.length, ') from teacher...');
    
    const sessionId = this.sessionIds.get(ws);
    const teacherSessionId = `teacher_${sessionId}`;
    
    // In a real implementation, this would process the audio and get transcription
    // Since we're using Web Speech API on the client side, this is just a fallback
    
    console.warn(`⚠️ No Web Speech API transcription found for ${teacherSessionId}, cannot process audio`);
  }
  
  /**
   * Handle TTS request message
   */
  private async handleTTSRequestMessage(ws: WebSocketClient, message: any): Promise<void> {
    const role = this.roles.get(ws);
    const languageCode = message.languageCode || this.languages.get(ws);
    const ttsService = message.ttsService || 'openai';
    const text = message.text;
    
    console.log(`Received TTS request from ${role} for service ${ttsService} in language ${languageCode}`);
    
    if (!text || !languageCode) {
      console.error('Missing required parameters for TTS request');
      return;
    }
    
    try {
      // Save current TTS service type
      const originalTtsType = process.env.TTS_SERVICE_TYPE || 'browser';
      
      // Set requested TTS service for this request
      process.env.TTS_SERVICE_TYPE = ttsService;
      
      // Use the translation service to generate speech audio
      // Using translateSpeech with empty buffer, passing only the text
      const result = await speechTranslationService.translateSpeech(
        Buffer.from(''), // Empty buffer since we have the text
        'en-US', // Source language doesn't matter for TTS
        languageCode,
        text // The text to synthesize
      );
      
      // Restore original TTS service type
      process.env.TTS_SERVICE_TYPE = originalTtsType;
      
      // Create response message with audio data
      const response: any = {
        type: 'tts_response',
        text: text,
        ttsService: ttsService,
        languageCode: languageCode,
        success: true
      };
      
      // Add audio data if available
      if (result && result.audioBuffer && result.audioBuffer.length > 0) {
        response.audioData = result.audioBuffer.toString('base64');
      } else {
        console.warn(`No audio data generated for TTS request with service ${ttsService}`);
        response.success = false;
        response.error = 'No audio data generated';
      }
      
      // Send response back to the client
      ws.send(JSON.stringify(response));
      
    } catch (error) {
      console.error(`Error processing TTS request with service ${ttsService}:`, error);
      
      // Send error response
      const errorResponse = {
        type: 'tts_response',
        text: text,
        ttsService: ttsService,
        languageCode: languageCode,
        success: false,
        error: error.message
      };
      
      ws.send(JSON.stringify(errorResponse));
    }
  }
  
  /**
   * Handle ping message
   */
  private handlePingMessage(ws: WebSocketClient, message: any): void {
    // Respond with pong message
    const response = {
      type: 'pong',
      timestamp: message.timestamp
    };
    
    ws.send(JSON.stringify(response));
  }
  
  /**
   * Handle WebSocket close event
   */
  private handleClose(ws: WebSocketClient): void {
    console.log('WebSocket disconnected, sessionId:', this.sessionIds.get(ws));
    
    // Remove from all tracking maps
    this.connections.delete(ws);
    this.roles.delete(ws);
    this.languages.delete(ws);
    this.sessionIds.delete(ws);
  }
  
  /**
   * Set up heartbeat mechanism to detect stale connections
   */
  private setupHeartbeat(): void {
    const interval = setInterval(() => {
      this.wss.clients.forEach((ws: any) => {
        // Cast the standard WebSocket to our custom type 
        const client = ws as unknown as WebSocketClient;
        
        if (client.isAlive === false) {
          console.log('Terminating inactive WebSocket connection');
          return client.terminate();
        }
        
        client.isAlive = false;
        client.ping();
        
        // Also send a ping message for clients that don't respond to standard pings
        const pingMessage = {
          type: 'ping',
          timestamp: Date.now()
        };
        
        try {
          client.send(JSON.stringify(pingMessage));
        } catch (error) {
          // Ignore errors during ping
        }
      });
    }, 30000); // Check every 30 seconds
    
    // Clear interval on server close
    this.wss.on('close', () => {
      clearInterval(interval);
    });
  }
  
  /**
   * Get all active connections
   */
  public getConnections(): Set<WebSocketClient> {
    return this.connections;
  }
  
  /**
   * Get role for a specific connection
   */
  public getRole(ws: WebSocketClient): string | undefined {
    return this.roles.get(ws);
  }
  
  /**
   * Get language for a specific connection
   */
  public getLanguage(ws: WebSocketClient): string | undefined {
    return this.languages.get(ws);
  }
}