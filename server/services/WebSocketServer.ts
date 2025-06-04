/**
 * PRIMARY WebSocket Server Implementation
 * 
 * This is the ACTIVE WebSocket server used by the application.
 * Handles real-time communication between teacher and students.
 * 
 * IMPORTANT: This is the implementation currently used by server.ts
 */
import { Server } from 'http';
import { WebSocketServer as WSServer } from 'ws';
import { speechTranslationService } from './TranslationService';
import { URL } from 'url';
import type {
  ClientSettings,
  WebSocketMessageToServer,
  RegisterMessageToServer,
  TranscriptionMessageToServer,
  AudioMessageToServer,
  TTSRequestMessageToServer,
  SettingsMessageToServer,
  PingMessageToServer,
  // Import ToClient message types as needed for constructing responses
  ConnectionMessageToClient,
  ClassroomCodeMessageToClient,
  RegisterResponseToClient,
  TranslationMessageToClient,
  TTSResponseMessageToClient,
  SettingsResponseToClient,
  PongMessageToClient,
  ErrorMessageToClient
} from './WebSocketTypes';
import { IncomingMessage } from 'http';
import { TextToSpeechFactory } from './textToSpeech/TextToSpeechService';
import { storage } from '../storage';
import { diagnosticsService } from './DiagnosticsService';

// Custom WebSocketClient type for our server
type WebSocketClient = WebSocket & {
  isAlive: boolean;
  sessionId: string;
  on: (event: string, listener: (...args: any[]) => void) => WebSocketClient;
  terminate: () => void;
  ping: () => void;
}

// Classroom session interface
interface ClassroomSession {
  code: string;
  sessionId: string;
  createdAt: number;
  lastActivity: number;
  teacherConnected: boolean;
  expiresAt: number;
}

export class WebSocketServer {
  private wss: WSServer;
  // We use the speechTranslationService facade
  
  // Connection tracking
  private connections: Map<string, ConnectionInfo> = new Map();
  private roles: Map<WebSocketClient, string> = new Map();
  private languages: Map<WebSocketClient, string> = new Map();
  private sessionIds: Map<WebSocketClient, string> = new Map();
  private clientSettings: Map<WebSocketClient, ClientSettings> = new Map();
  
  // Classroom management
  private classrooms: Map<string, ClassroomInfo> = new Map();
  private classroomCleanupInterval: NodeJS.Timeout | null = null;
  
  // Stats
  private sessionCounter: number = 0;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  
  constructor(server: Server) {
    this.wss = new WSServer({ server });
    
    // Set up event handlers
    this.setupEventHandlers();
    
    // Set up classroom session cleanup
    this.setupClassroomCleanup();
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
  private handleConnection(ws: WebSocketClient, request: IncomingMessage): void {
    const connectionId = this.generateConnectionId();
    const clientIp = this.getClientIp(request);
    
    console.log(`New connection from ${clientIp}`);
    
    // Track connection in diagnostics
    diagnosticsService.recordConnection(connectionId, 'unknown');
    
    // Mark as alive
    ws.isAlive = true;
    
    // Parse URL for classroom code
    let sessionId = this.generateSessionId();
    let classroomCode: string | null = null;
    
    if (request?.url) {
      const url = new URL(request.url, 'http://localhost');
      classroomCode = url.searchParams.get('class') || url.searchParams.get('code');
      
      if (classroomCode) {
        // Validate classroom code
        if (!this.isValidClassroomCode(classroomCode)) {
          console.log(`Invalid classroom code attempted: ${classroomCode}`);
          ws.send(JSON.stringify({
            type: 'error',
            message: 'Classroom session expired or invalid. Please ask teacher for new link.',
            code: 'INVALID_CLASSROOM'
          }));
          ws.close(1008, 'Invalid classroom session');
          return;
        }
        
        // Use classroom session ID
        const session = this.classrooms.get(classroomCode);
        if (session) {
          sessionId = session.sessionId;
          console.log(`Client joining classroom ${classroomCode} with session ${sessionId}`);
        }
      }
    }
    
    // Store connection data
    this.connections.set(connectionId, {
      id: connectionId,
      role: this.roles.get(ws) || 'unknown',
      languageCode: this.languages.get(ws) || 'unknown',
      sessionId: sessionId || 'unknown',
      classroomCode: classroomCode,
      createdAt: Date.now()
    });
    
    // Send immediate connection confirmation with classroom code if applicable
    this.sendConnectionConfirmation(ws, classroomCode);
    
    // Set up message handler
    ws.on('message', (data: any) => {
      this.handleMessage(connectionId, data.toString());
    });
    
    // Set up pong handler for heartbeat
    ws.on('pong', () => {
      ws.isAlive = true;
    });
    
    // Set up close handler
    ws.on('close', () => {
      console.log('Connection closed');
      
      // Track disconnection in diagnostics
      diagnosticsService.recordConnectionClosed(connectionId);
      
      // Clean up connection
      const connection = this.connections.get(connectionId);
      if (connection) {
        // If teacher, clean up classroom
        if (connection.role === 'teacher' && connection.classroomCode) {
          this.classrooms.delete(connection.classroomCode);
          
          // Track session end
          diagnosticsService.recordSessionEnd(connection.classroomCode);
        }
        
        this.connections.delete(connectionId);
      }
    });
    
    // Set up error handler
    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
    });
  }

  /**
   * Send connection confirmation to client
   */
  private sendConnectionConfirmation(ws: WebSocketClient, classroomCode?: string | null): void {
    try {
      const sessionId = this.sessionIds.get(ws);
      const role = this.roles.get(ws);
      const language = this.languages.get(ws);
      
      const message: ConnectionMessageToClient = {
        type: 'connection',
        status: 'connected',
        sessionId: sessionId || 'unknown',
        role: role as ('teacher' | 'student' | undefined),
        language: language,
        classroomCode: classroomCode || undefined
      };
      
      ws.send(JSON.stringify(message));
    } catch (error) {
      console.error('Error sending connection confirmation:', error);
    }
  }
  
  /**
   * Handle incoming WebSocket message
   */
  private async handleMessage(connectionId: string, data: string): Promise<void> {
    try {
      const connection = this.connections.get(connectionId);
      
      if (!connection) {
        console.error('Connection not found:', connectionId);
        return;
      }

      // Parse message data
      const message = JSON.parse(data) as WebSocketMessageToServer;
      
      // Process message based on type
      switch (message.type) {
        case 'register':
          await this.handleRegister(connectionId, message as RegisterMessageToServer);
          break;
        
        case 'transcription':
          await this.handleTranscription(connectionId, message as TranscriptionMessageToServer);
          break;
        
        case 'tts_request':
          await this.handleTTSRequestMessage(connectionId, message as TTSRequestMessageToServer);
          break;
          
        case 'audio':
          await this.handleAudioMessage(connectionId, message as AudioMessageToServer);
          break;
          
        case 'settings':
          this.handleSettingsMessage(connectionId, message as SettingsMessageToServer);
          break;
          
        case 'ping':
          this.handlePingMessage(connectionId, message as PingMessageToServer);
          break;
          
        case 'pong':
          // No specific handling needed
          break;
          
        default:
          console.warn('Unknown message type:', message.type);
      }
    } catch (error) {
      console.error('Error handling message:', error);
      this.sendError(connectionId, 'Failed to process message');
    }
  }
  
  /**
   * Handle registration message
   */
  private async handleRegister(connectionId: string, message: RegisterMessageToServer): Promise<void> {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    console.log(`Processing message type=register from connection: role=${message.role}, languageCode=${message.languageCode}`);
    console.log(`Changing connection role from ${connection.role} to ${message.role}`);
    
    // Update connection info
    connection.role = message.role;
    connection.languageCode = message.languageCode;
    
    // Update diagnostics with actual role
    diagnosticsService.recordConnectionClosed(connectionId); // Remove old "unknown" connection
    diagnosticsService.recordConnection(connectionId, message.role);
    
    if (message.role === 'teacher') {
      // Generate classroom code for teacher
      const classroomCode = this.generateClassroomCode();
      connection.classroomCode = classroomCode;
      
      // Create classroom
      this.classrooms.set(classroomCode, {
        teacherId: connectionId,
        students: new Set(),
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
      });
      
      // Track session start
      diagnosticsService.recordSessionStart(classroomCode);
      
      // Send classroom code to teacher
      this.send(connectionId, {
        type: 'classroom_code',
        code: classroomCode,
        expiresAt: this.classrooms.get(classroomCode)?.expiresAt
      });
      
      // Store session in database
      await storage.createSession({
        sessionId: classroomCode,
        teacherLanguage: message.languageCode,
        isActive: true
      });
    } else if (message.role === 'student' && message.classroomCode) {
      // Join classroom as student
      const classroom = this.classrooms.get(message.classroomCode);
      if (classroom) {
        classroom.students.add(connectionId);
        connection.classroomCode = message.classroomCode;
        
        // Send success message
        this.send(connectionId, {
          type: 'register',
          status: 'success',
          message: 'Joined classroom successfully'
        });
      } else {
        this.sendError(connectionId, 'Invalid classroom code');
      }
    }
    
    // Update language if provided
    if (message.languageCode) {
      this.languages.set(connection as WebSocketClient, message.languageCode);
    }
    
    // Store client settings
    const settings: ClientSettings = this.clientSettings.get(connection as WebSocketClient) || {};
    
    // Update text-to-speech service type if provided
    if (message.settings?.ttsServiceType) {
      settings.ttsServiceType = message.settings.ttsServiceType;
      console.log(`Client requested TTS service type: ${settings.ttsServiceType}`);
    }
    
    // Store updated settings
    this.clientSettings.set(connection as WebSocketClient, settings);
    
    console.log('Updated connection:', 
      `role=${this.roles.get(connection as WebSocketClient)}, languageCode=${this.languages.get(connection as WebSocketClient)}, ttsService=${settings.ttsServiceType || 'default'}`);
    
    // Send confirmation
    const response: RegisterResponseToClient = {
      type: 'register',
      status: 'success',
      data: {
        role: this.roles.get(connection as WebSocketClient) as ('teacher' | 'student' | undefined),
        languageCode: this.languages.get(connection as WebSocketClient),
        settings: settings
      }
    };
    
    this.send(connectionId, response);
  }
  
  /**
   * Handle transcription message
   */
  private async handleTranscription(connectionId: string, message: TranscriptionMessageToServer): Promise<void> {
    const connection = this.connections.get(connectionId);
    if (!connection || connection.role !== 'teacher') {
      console.error('Ignoring transcription from non-teacher role:', connection?.role);
      console.log(`Received transcription from ${connection?.role} : ${message.text}`);
      return;
    }

    console.log(`Received transcription from teacher : ${message.text}`);
    
    // Track transcription in diagnostics
    diagnosticsService.recordTranscription();
    
    // Store transcript in database
    if (connection.classroomCode) {
      await storage.addTranscript({
        sessionId: connection.classroomCode,
        language: connection.languageCode || 'en-US',
        text: message.text
      });
    }

    // Get students in the classroom
    const classroom = this.classrooms.get(connection.classroomCode || '');
    if (!classroom) return;

    // Translate for each student
    const translationPromises = Array.from(classroom.students).map(async (studentId) => {
      const student = this.connections.get(studentId);
      if (!student || !student.languageCode) return;

      try {
        const startTime = Date.now();
        
        // Translate the text
        const result = await speechTranslationService.translateSpeech({
          audioBuffer: Buffer.from(''), // Empty buffer since we have text
          sourceLanguage: connection.languageCode || 'en-US',
          targetLanguage: student.languageCode,
          text: message.text // Pre-transcribed text
        });

        const translationTime = Date.now() - startTime;
        
        // Track translation time in diagnostics
        diagnosticsService.recordTranslation(translationTime);
        
        // Store translation in database
        await storage.addTranslation({
          sourceLanguage: connection.languageCode || 'en-US',
          targetLanguage: student.languageCode,
          originalText: message.text,
          translatedText: result.translatedText,
          latency: translationTime
        });

        // Track audio generation if applicable
        if (result.audioData) {
          const audioStartTime = Date.now();
          // ... audio processing ...
          diagnosticsService.recordAudioGeneration(Date.now() - audioStartTime);
        }

        // Send translation to student
        this.send(studentId, {
          type: 'translation',
          originalText: message.text,
          translatedText: result.translatedText,
          audioData: result.audioData
        });

      } catch (error) {
        console.error(`Translation error for student ${studentId}:`, error);
        this.sendError(studentId, 'Translation failed');
      }
    });

    await Promise.all(translationPromises);
  }
  
  /**
   * Handle audio message
   */
  private async handleAudioMessage(connectionId: string, message: AudioMessageToServer): Promise<void> {
    const connection = this.connections.get(connectionId);
    
    // Only process audio from teacher
    if (connection?.role !== 'teacher') {
      console.log('Ignoring audio from non-teacher role:', connection?.role);
      return;
    }
    
    // Process audio data
    if (message.data) {
      await this.processTeacherAudio(connectionId, message.data);
    }
  }
  
  /**
   * Process audio from teacher
   */
  private async processTeacherAudio(connectionId: string, audioData: string): Promise<void> {
    // Validate audio data
    if (!audioData || audioData.length < 100) {
      console.log('Received invalid or too small audio data (length:', audioData.length, ')');
      return;
    }
    
    console.log('Processing audio data (length:', audioData.length, ') from teacher...');
    
    try {
      // Convert base64 to buffer
      const audioBuffer = Buffer.from(audioData, 'base64');
      
      // Skip if buffer is too small
      if (audioBuffer.length < 100) {
        console.log('Decoded audio buffer too small:', audioBuffer.length);
        return;
      }
      
      // Get teacher language
      const teacherLanguage = this.languages.get(this.connections.get(connectionId) as WebSocketClient) || 'en-US';
      
      // Check the Web Speech API transcription info from the client
      let webSpeechTranscription = '';
      try {
        // The first few bytes might be a JSON object with transcription info
        // from the Web Speech API in the browser
        const bufferStart = audioBuffer.slice(0, 200).toString('utf8');
        if (bufferStart.startsWith('{') && bufferStart.includes('transcription')) {
          const endIndex = bufferStart.indexOf('}') + 1;
          const jsonStr = bufferStart.substring(0, endIndex);
          const data = JSON.parse(jsonStr);
          webSpeechTranscription = data.transcription || '';
          
          console.log('Web Speech API transcription from client:', webSpeechTranscription);
        }
      } catch (err) {
        console.warn('No Web Speech API transcription found in audio data');
      }
      
      // Get session ID for reference
      const sessionId = this.sessionIds.get(this.connections.get(connectionId) as WebSocketClient);
    } catch (error) {
      console.error('Error processing teacher audio:', error);
    }
  }
  
  /**
   * Handle TTS request message
   */
  private async handleTTSRequestMessage(connectionId: string, message: TTSRequestMessageToServer): Promise<void> {
    const text = message.text;
    const languageCode = message.languageCode;
    
    if (!this.validateTTSRequest(text, languageCode)) {
      await this.sendTTSErrorResponse(connectionId, 'Invalid TTS request parameters');
      return;
    }
    
    // Always use OpenAI TTS for best quality
    const ttsServiceType = 'openai';
    
    try {
      // Generate TTS audio
      const audioBuffer = await this.generateTTSAudio(
        text,
        languageCode,
        ttsServiceType,
        message.voice
      );
      
      if (audioBuffer && audioBuffer.length > 0) {
        // Send successful response with audio
        await this.sendTTSResponse(
          connectionId,
          text,
          languageCode,
          audioBuffer,
          ttsServiceType
        );
      } else {
        // Send error if no audio was generated
        await this.sendTTSErrorResponse(connectionId, 'Failed to generate audio');
      }
    } catch (error) {
      console.error('Error handling TTS request:', error);
      await this.sendTTSErrorResponse(connectionId, 'TTS generation error');
    }
  }
  
  /**
   * Validate TTS request parameters
   */
  private validateTTSRequest(text: string, languageCode: string): boolean {
    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      console.error('Invalid TTS text:', text);
      return false;
    }
    
    if (!languageCode || typeof languageCode !== 'string') {
      console.error('Invalid TTS language code:', languageCode);
      return false;
    }
    
    return true;
  }
  
  /**
   * Generate TTS audio
   */
  private async generateTTSAudio(
    text: string,
    languageCode: string,
    ttsServiceType: string,
    voice?: string
  ): Promise<Buffer> {
    try {
      // Use empty source language as we aren't translating, just doing TTS
      const result = await speechTranslationService.translateSpeech(
        Buffer.from(''), // Empty buffer as we already have the text
        languageCode,   // Source language is the same as target for TTS-only
        languageCode,   // Target language
        text,           // Text to convert to speech
        { ttsServiceType } // Force specified TTS service type
      );
      
      return result.audioBuffer;
    } catch (error) {
      console.error('Error generating TTS audio:', error);
      return Buffer.from(''); // Return empty buffer on error
    }
  }
  
  /**
   * Send TTS response with audio data
   */
  private async sendTTSResponse(
    connectionId: string,
    text: string,
    languageCode: string,
    audioBuffer: Buffer,
    ttsServiceType: string
  ): Promise<void> {
    try {
      // Create base message
      const response: Partial<TTSResponseMessageToClient> = {
        type: 'tts_response',
        status: 'success',
        text,
        languageCode,
        ttsServiceType,
        timestamp: Date.now()
      };
      
      // Check if this is a browser speech synthesis marker
      const bufferString = audioBuffer.toString('utf8');
      
      if (bufferString.startsWith('{"type":"browser-speech"')) {
        response.useClientSpeech = true;
        try {
          response.speechParams = JSON.parse(bufferString);
        } catch (error) {
          console.error('Error parsing speech params:', error);
          response.speechParams = {
            type: 'browser-speech',
            text,
            languageCode,
            autoPlay: true
          };
        }
      } else {
        // Real audio data
        response.audioData = audioBuffer.toString('base64');
        response.useClientSpeech = false;
      }
      
      // Send response
      this.send(connectionId, response as TTSResponseMessageToClient);
      console.log(`TTS response sent successfully for language '${languageCode}'`);
    } catch (error) {
      console.error('Error sending TTS response:', error);
      // Try to send error message if possible
      try {
        await this.sendTTSErrorResponse(connectionId, 'Failed to send audio data');
      } catch (sendError) {
        console.error('Error sending TTS error response:', sendError);
      }
    }
  }
  
  /**
   * Send TTS error response
   */
  private async sendTTSErrorResponse(
    connectionId: string,
    messageText: string,
    code: string = 'TTS_ERROR'
  ): Promise<void> {
    try {
      const ttsErrorResponse: TTSResponseMessageToClient = {
        type: 'tts_response',
        status: 'error',
        error: {
          message: messageText,
          code: code
        },
        timestamp: Date.now()
      };
      
      this.send(connectionId, ttsErrorResponse);
      console.error(`TTS error response sent: ${messageText}`);
    } catch (error) {
      console.error('Error sending TTS error response:', error);
    }
  }
  
  /**
   * Handle settings message
   */
  private handleSettingsMessage(connectionId: string, message: SettingsMessageToServer): void {
    const connection = this.connections.get(connectionId);
    
    // Initialize settings for this client if not already present
    const settings: ClientSettings = this.clientSettings.get(this.connections.get(connectionId) as WebSocketClient) || {};
    
    // Update settings with new values
    if (message.settings) {
      Object.assign(settings, message.settings);
    }
    
    // Special handling for ttsServiceType since it can be specified outside settings object
    if (message.ttsServiceType) {
      settings.ttsServiceType = message.ttsServiceType;
      console.log(`Updated TTS service type for ${connection?.role} to: ${settings.ttsServiceType}`);
    }
    
    // Store updated settings
    this.clientSettings.set(this.connections.get(connectionId) as WebSocketClient, settings);
    
    // Send confirmation
    const response: SettingsResponseToClient = {
      type: 'settings',
      status: 'success',
      settings
    };
    
    this.send(connectionId, response);
  }
  
  /**
   * Handle ping message
   */
  private handlePingMessage(connectionId: string, message: PingMessageToServer): void {
    // Mark as alive for heartbeat
    const connection = this.connections.get(connectionId);
    if (connection) {
      connection.isAlive = true;
    }
    
    // Send pong response
    const response: PongMessageToClient = {
      type: 'pong',
      timestamp: Date.now(),
      originalTimestamp: message.timestamp
    };
    
    try {
      this.send(connectionId, response);
    } catch (error) {
      console.error('Error sending pong response:', error);
    }
  }
  
  /**
   * Handle WebSocket close event
   */
  private handleClose(connectionId: string): void {
    console.log('WebSocket disconnected, sessionId:', this.sessionIds.get(this.connections.get(connectionId) as WebSocketClient));
    
    // Remove from all maps
    this.connections.delete(connectionId);
    this.roles.delete(this.connections.get(connectionId) as WebSocketClient);
    this.languages.delete(this.connections.get(connectionId) as WebSocketClient);
    this.sessionIds.delete(this.connections.get(connectionId) as WebSocketClient);
    this.clientSettings.delete(this.connections.get(connectionId) as WebSocketClient);
  }
  
  /**
   * Set up heartbeat mechanism to detect dead connections
   */
  private setupHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      this.wss.clients.forEach((ws: any) => {
        const client = ws as WebSocketClient;
        
        if (!client.isAlive) {
          console.log('Terminating dead connection');
          return client.terminate();
        }
        
        // Mark as not alive and send ping
        client.isAlive = false;
        client.ping();
        
        // Also send a JSON ping message for clients that don't handle ping frames
        try {
          client.send(JSON.stringify({ type: 'ping', timestamp: Date.now() }));
        } catch (error) {
          // Ignore send errors
        }
      });
    }, 30000); // 30 seconds
  }
  
  /**
   * Get connections
   */
  public getConnections(): Map<string, ConnectionInfo> {
    return this.connections;
  }
  
  /**
   * Get connection role
   */
  public getRole(connectionId: string): string | undefined {
    return this.connections.get(connectionId)?.role;
  }
  
  /**
   * Get connection language
   */
  public getLanguage(connectionId: string): string | undefined {
    return this.connections.get(connectionId)?.languageCode;
  }
  
  /**
   * Generate a classroom code for a session
   */
  private generateClassroomCode(): string {
    // Generate new 6-character code
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code: string;
    
    // Ensure uniqueness
    do {
      code = '';
      for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
      }
    } while (this.classrooms.has(code));
    
    // Create session with 2-hour expiration
    const session: ClassroomSession = {
      code,
      sessionId: code,
      createdAt: Date.now(),
      lastActivity: Date.now(),
      teacherConnected: true,
      expiresAt: Date.now() + (2 * 60 * 60 * 1000) // 2 hours
    };
    
    this.classrooms.set(code, session);
    console.log(`Created new classroom session: ${code}`);
    
    return code;
  }
  
  /**
   * Validate classroom code
   */
  private isValidClassroomCode(code: string): boolean {
    // Check format
    if (!/^[A-Z0-9]{6}$/.test(code)) {
      return false;
    }
    
    const session = this.classrooms.get(code);
    if (!session) {
      return false;
    }
    
    // Check expiration
    if (Date.now() > session.expiresAt) {
      this.classrooms.delete(code);
      console.log(`Classroom code ${code} expired and removed`);
      return false;
    }
    
    // Update last activity
    session.lastActivity = Date.now();
    return true;
  }
  
  /**
   * Set up periodic cleanup of expired classroom sessions
   */
  private setupClassroomCleanup(): void {
    // Clean up expired sessions every 15 minutes
    this.classroomCleanupInterval = setInterval(() => {
      const now = Date.now();
      let cleaned = 0;
      
      for (const [code, session] of this.classrooms.entries()) {
        if (now > session.expiresAt) {
          this.classrooms.delete(code);
          cleaned++;
        }
      }
      
      if (cleaned > 0) {
        console.log(`Cleaned up ${cleaned} expired classroom sessions`);
      }
    }, 15 * 60 * 1000); // 15 minutes
  }
  
  /**
   * Close WebSocket server
   */
  public close(): void {
    // Clear classroom cleanup interval
    if (this.classroomCleanupInterval) {
      clearInterval(this.classroomCleanupInterval);
      this.classroomCleanupInterval = null;
    }
    
    // Clear heartbeat interval
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    
    this.wss.close();
  }
  
  /**
   * Generate a unique session ID
   */
  private generateSessionId(): string {
    this.sessionCounter++;
    return `session-${this.sessionCounter}-${Date.now()}`;
  }

  private generateConnectionId(): string {
    this.sessionCounter++;
    return `connection-${this.sessionCounter}-${Date.now()}`;
  }

  private getClientIp(request: IncomingMessage): string {
    // Implement your logic to extract the client IP from the request
    return '127.0.0.1'; // Placeholder return, actual implementation needed
  }

  private send(connectionId: string, message: any): void {
    // Implement your logic to send a message to the client
    // This is a placeholder and should be replaced with the actual implementation
    console.log(`Sending message to connection ${connectionId}:`, message);
  }

  private sendError(connectionId: string, message: string): void {
    // Implement your logic to send an error message to the client
    // This is a placeholder and should be replaced with the actual implementation
    console.error(`Sending error to connection ${connectionId}:`, message);
  }
}