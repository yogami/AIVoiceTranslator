/**
 * PRIMARY WebSocket Server Implementation
 * 
 * This is the ACTIVE WebSocket server used by the application.
 * Handles real-time communication between teacher and students.
 * 
 * IMPORTANT: This is the implementation currently used by server.ts
 */
import { WebSocketServer as WSServer, WebSocket } from 'ws';
import * as http from 'http'; // Changed to namespace import
import logger from '../logger';
import { speechTranslationService } from './TranslationService'; // Corrected import path
import { audioTranscriptionService } from './transcription/AudioTranscriptionService'; // Corrected import path
import { storage } from '../storage'; // Changed to named import
import { config } from '../config'; // Removed AppConfig, already have config instance
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
  private connections: Set<WebSocketClient> = new Set();
  private roles: Map<WebSocketClient, string> = new Map();
  private languages: Map<WebSocketClient, string> = new Map();
  private sessionIds: Map<WebSocketClient, string> = new Map();
  private clientSettings: Map<WebSocketClient, ClientSettings> = new Map();
  
  // Classroom management
  private classroomSessions: Map<string, ClassroomSession> = new Map();
  private classroomCleanupInterval: NodeJS.Timeout | null = null;

  // Stats
  private sessionCounter: number = 0;
  private heartbeatInterval: NodeJS.Timeout | null = null;

  constructor(server: http.Server) { // Use http.Server type
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
  private handleConnection(ws: WebSocketClient, request?: any): void {
    logger.info('New WebSocket connection established');
    
    // Mark as alive
    ws.isAlive = true;
    
    // Parse URL for classroom code
    let sessionId = this.generateSessionId();
    let classroomCode: string | null = null;
    
    if (request?.url) {
      // Construct the base URL using the configured host and port
      const baseUrl = `http://${config.server.host}:${config.server.port}`;
      const url = new URL(request.url, baseUrl);
      classroomCode = url.searchParams.get('class') || url.searchParams.get('code');
      
      if (classroomCode) {
        // Validate classroom code
        if (!this.isValidClassroomCode(classroomCode)) {
          logger.warn(`Invalid classroom code attempted: ${classroomCode}`);
          ws.send(JSON.stringify({
            type: 'error',
            message: 'Classroom session expired or invalid. Please ask teacher for new link.',
            code: 'INVALID_CLASSROOM'
          }));
          ws.close(1008, 'Invalid classroom session');
          return;
        }
        
        // Use classroom session ID
        const session = this.classroomSessions.get(classroomCode);
        if (session) {
          sessionId = session.sessionId;
          logger.info(`Client joining classroom ${classroomCode} with session ${sessionId}`);
        }
      }
    }
    
    // Store connection data
    this.connections.add(ws);
    this.sessionIds.set(ws, sessionId);
    
    // Create session in storage for metrics tracking
    this.createSessionInStorage(sessionId).catch(error => {
      logger.error('Failed to create session in storage:', { error });
      // Continue without metrics - don't break core functionality
    });
    
    // Send immediate connection confirmation with classroom code if applicable
    this.sendConnectionConfirmation(ws, classroomCode);
    
    // Set up message handler
    ws.on('message', (data: any) => {
      this.handleMessage(ws, data.toString());
    });
    
    // Set up pong handler for heartbeat
    ws.on('pong', () => {
      ws.isAlive = true;
    });
    
    // Set up close handler
    ws.on('close', () => {
      this.handleClose(ws);
    });
    
    // Set up error handler
    ws.on('error', (error) => {
      logger.error('WebSocket error:', { error });
    });
  }

  /**
   * Create session in storage for metrics tracking
   */
  private async createSessionInStorage(sessionId: string): Promise<void> {
    try {
      await storage.createSession({
        sessionId,
        isActive: true
        // startTime is automatically set by the database default
      });
    } catch (error) {
      // Log but don't throw - metrics should not break core functionality
      logger.error('Failed to create session in storage:', { error });
    }
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
      logger.error('Error sending connection confirmation:', { error });
    }
  }
  
  /**
   * Handle incoming WebSocket message
   */
  async handleMessage(ws: WebSocketClient, data: string): Promise<void> {
    try {
      // Parse message data
      const message = JSON.parse(data) as WebSocketMessageToServer;
      
      // Process message based on type
      switch (message.type) {
        case 'register':
          this.handleRegisterMessage(ws, message as RegisterMessageToServer);
          break;
        
        case 'transcription':
          await this.handleTranscriptionMessage(ws, message as TranscriptionMessageToServer);
          break;
        
        case 'tts_request':
          await this.handleTTSRequestMessage(ws, message as TTSRequestMessageToServer);
          break;
          
        case 'audio':
          await this.handleAudioMessage(ws, message as AudioMessageToServer);
          break;
          
        case 'settings':
          this.handleSettingsMessage(ws, message as SettingsMessageToServer);
          break;
          
        case 'ping':
          this.handlePingMessage(ws, message as PingMessageToServer);
          break;
          
        case 'pong':
          // No specific handling needed
          break;
          
        default:
          logger.warn('Unknown message type:', { type: (message as any).type });
      }
    } catch (error) {
      logger.error('Error handling message:', { error, data });
    }
  }
  
  /**
   * Handle registration message
   */
  private handleRegisterMessage(ws: WebSocketClient, message: RegisterMessageToServer): void {
    logger.info('Processing message type=register from connection:', 
      { role: message.role, languageCode: message.languageCode });
    
    const currentRole = this.roles.get(ws);
    
    // Update role if provided
    if (message.role) {
      if (currentRole !== message.role) {
        logger.info(`Changing connection role from ${currentRole} to ${message.role}`);
      }
      this.roles.set(ws, message.role);
      
      // If registering as teacher, generate or update classroom code
      if (message.role === 'teacher') {
        const sessionId = this.sessionIds.get(ws);
        if (sessionId) {
          const classroomCode = this.generateClassroomCode(sessionId);
          const sessionInfo = this.classroomSessions.get(classroomCode);
          
          // Update session with teacher language
          if (message.languageCode) {
            this.updateSessionInStorage(sessionId, {
              teacherLanguage: message.languageCode
            }).catch(error => {
              logger.error('Failed to update session with teacher language:', { error });
            });
          }
          
          const response: ClassroomCodeMessageToClient = {
            type: 'classroom_code',
            code: classroomCode,
            sessionId: sessionId,
            expiresAt: sessionInfo?.expiresAt || Date.now() + (2 * 60 * 60 * 1000) // Fallback expiration
          };
          ws.send(JSON.stringify(response));
          
          logger.info(`Generated classroom code ${classroomCode} for teacher session ${sessionId}`);
        }
      }
    }
    
    // Update language if provided
    if (message.languageCode) {
      this.languages.set(ws, message.languageCode);
    }
    
    // Store client settings
    const settings: ClientSettings = this.clientSettings.get(ws) || {};
    
    // Update text-to-speech service type if provided
    if (message.settings?.ttsServiceType) {
      settings.ttsServiceType = message.settings.ttsServiceType;
      logger.info(`Client requested TTS service type: ${settings.ttsServiceType}`);
    }
    
    // Store updated settings
    this.clientSettings.set(ws, settings);
    
    logger.info('Updated connection:', 
      { role: this.roles.get(ws), languageCode: this.languages.get(ws), ttsService: settings.ttsServiceType || 'default' });
    
    // Send confirmation
    const response: RegisterResponseToClient = {
      type: 'register',
      status: 'success',
      data: {
        role: this.roles.get(ws) as ('teacher' | 'student' | undefined),
        languageCode: this.languages.get(ws),
        settings: settings
      }
    };
    
    ws.send(JSON.stringify(response));
  }
  
  /**
   * Update session in storage
   */
  private async updateSessionInStorage(sessionId: string, updates: any): Promise<void> {
    try {
      await storage.updateSession(sessionId, updates);
    } catch (error) {
      logger.error('Failed to update session in storage:', { error });
    }
  }
  
  /**
   * Handle transcription message
   */
  private async handleTranscriptionMessage(ws: WebSocketClient, message: TranscriptionMessageToServer): Promise<void> {
    logger.info('Received transcription from', { role: this.roles.get(ws), text: message.text });
    
    // Start tracking latency when transcription is received
    const startTime = Date.now();
    const latencyTracking = {
      start: startTime,
      components:
      {
        preparation: 0,
        translation: 0,
        tts: 0,
        processing: 0
      }
    };
    
    const role = this.roles.get(ws);
    const sessionId = this.sessionIds.get(ws);
    
    // Only process transcriptions from teacher
    if (role !== 'teacher') {
      logger.warn('Ignoring transcription from non-teacher role:', { role });
      return;
    }
    
    // Get all student connections and their languages
    const { studentConnections, studentLanguages } = this.getStudentConnectionsAndLanguages();
    
    if (studentConnections.length === 0) {
      logger.info('No students connected, skipping translation');
      return;
    }
    
    // Translate text to all student languages
    const teacherLanguage = this.languages.get(ws) || 'en-US';
    
    // Perform translations for all required languages
    const { translations, translationResults, latencyInfo } = 
      await this.translateToMultipleLanguages(
        message.text, 
        teacherLanguage, 
        studentLanguages,
        startTime,
        latencyTracking
      );
    
    // Update latency tracking with the results
    Object.assign(latencyTracking.components, latencyInfo);
    
    // Calculate processing latency before sending translations
    const processingEndTime = Date.now();
    latencyTracking.components.processing = processingEndTime - startTime - latencyTracking.components.translation;
    
    // Send translations to students
    this.sendTranslationsToStudents(
      studentConnections,
      message.text,
      teacherLanguage,
      translations,
      translationResults,
      startTime,
      latencyTracking
    );
  }
  
  /**
   * Get all student connections and their unique languages
   */
  private getStudentConnectionsAndLanguages(): { 
    studentConnections: WebSocketClient[], 
    studentLanguages: string[] 
  } {
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
    
    return { studentConnections, studentLanguages };
  }
  
  /**
   * Translate text to multiple languages
   */
  private async translateToMultipleLanguages(
    text: string,
    sourceLanguage: string,
    targetLanguages: string[],
    startTime: number,
    latencyTracking: {
      start: number;
      components: {
        preparation: number;
        translation: number;
        tts: number;
        processing: number;
      };
    }
  ): Promise<{
    translations: Record<string, string>;
    translationResults: Record<string, { 
      originalText: string;
      translatedText: string;
      audioBuffer: Buffer;
    }>;
    latencyInfo: {
      translation: number;
      tts: number;
    };
  }> {
    // Storage for translations
    const translations: Record<string, string> = {};
    const translationResults: Record<string, { 
      originalText: string;
      translatedText: string;
      audioBuffer: Buffer;
    }> = {};
    
    // Latency tracking
    const latencyInfo = {
      translation: 0,
      tts: 0
    };
    
    // Always use OpenAI TTS service for best quality
    const ttsServiceToUse = 'openai';
    
    // Translate for each language
    for (const targetLanguage of targetLanguages) {
      try {
        logger.info(`Using OpenAI TTS service for language '${targetLanguage}' (overriding teacher's selection)`);
        
        // Measure translation and TTS latency
        const translationStartTime = Date.now();
        
        // Perform the translation with OpenAI TTS service
        const result = await speechTranslationService.translateSpeech(
          Buffer.from(''), // Empty buffer as we already have the text
          sourceLanguage,
          targetLanguage,
          text, // Use the pre-transcribed text
          { ttsServiceType: ttsServiceToUse } // Force OpenAI TTS service
        );
        
        // Record the translation/TTS latency
        const translationEndTime = Date.now();
        const elapsedTime = translationEndTime - translationStartTime;
        
        // Since this includes both translation and TTS, we'll estimate the split
        // TTS typically takes about 70% of the time
        const ttsTime = Math.round(elapsedTime * 0.7);
        const translationTime = elapsedTime - ttsTime;
        
        latencyInfo.translation = Math.max(
          latencyInfo.translation,
          translationTime
        );
        
        latencyInfo.tts = Math.max(
          latencyInfo.tts,
          ttsTime
        );
        
        // Store the full result object for this language
        translationResults[targetLanguage] = result;
        
        // Also store just the text for backward compatibility
        translations[targetLanguage] = result.translatedText;
      } catch (error) {
        logger.error(`Error translating to ${targetLanguage}:`, { error });
        translations[targetLanguage] = text; // Fallback to original text
        translationResults[targetLanguage] = {
          originalText: text,
          translatedText: text,
          audioBuffer: Buffer.from('') // Empty buffer for fallback
        };
      }
    }
    
    return { translations, translationResults, latencyInfo };
  }
  
  /**
   * Send translations to students
   */
  private sendTranslationsToStudents(
    studentConnections: WebSocketClient[],
    originalText: string,
    sourceLanguage: string,
    translations: Record<string, string>,
    translationResults: Record<string, { 
      originalText: string;
      translatedText: string;
      audioBuffer: Buffer;
    }>,
    startTime: number,
    latencyTracking: {
      start: number;
      components: {
        preparation: number;
        translation: number;
        tts: number;
        processing: number;
      };
    }
  ): void {
    // Send translations to each student
    studentConnections.forEach(student => {
      const studentLanguage = this.languages.get(student);
      
      if (studentLanguage && translationResults[studentLanguage]) {
        const result = translationResults[studentLanguage];
        const currentTime = Date.now();
        const totalLatency = currentTime - startTime;
        
        // Get TTS service type for this student
        const studentSettings = this.clientSettings.get(student) || {};
        const ttsServiceType = studentSettings.ttsServiceType || 'openai';
        
        // Create translation message
        const translationMessage = this.createTranslationMessage(
          result.translatedText,
          originalText,
          sourceLanguage,
          studentLanguage,
          ttsServiceType,
          totalLatency,
          currentTime,
          latencyTracking
        );
        
        // Add audio data if available
        if (result.audioBuffer && result.audioBuffer.length > 0) {
          this.addAudioDataToMessage(
            translationMessage,
            result.audioBuffer,
            studentLanguage,
            result.translatedText,
            ttsServiceType
          );
        }
        
        // Send the translation message
        student.send(JSON.stringify(translationMessage));
        
        // Store translation in storage for metrics
        this.storeTranslationMetrics(
          sourceLanguage,
          studentLanguage,
          originalText,
          result.translatedText,
          totalLatency
        ).catch(error => {
          logger.error('Failed to store translation metrics:', { error });
        });
      }
    });
  }
  
  /**
   * Store translation metrics in storage
   */
  private async storeTranslationMetrics(
    sourceLanguage: string,
    targetLanguage: string,
    originalText: string,
    translatedText: string,
    latency: number
  ): Promise<void> {
    try {
      await storage.addTranslation({
        sourceLanguage,
        targetLanguage,
        originalText,
        translatedText,
        latency
        // timestamp is automatically set by the database default
      });
    } catch (error) {
      logger.error('Failed to store translation metrics:', { error });
    }
  }
  
  /**
   * Create a translation message
   */
  private createTranslationMessage(
    translatedText: string,
    originalText: string,
    sourceLanguage: string,
    targetLanguage: string,
    ttsServiceType: string,
    totalLatency: number,
    currentTime: number,
    latencyTracking: {
      components: {
        translation: number;
        tts: number;
        processing: number;
      };
    }
  ): TranslationMessageToClient {
    return {
      type: 'translation',
      text: translatedText,
      originalText: originalText,
      sourceLanguage: sourceLanguage,
      targetLanguage: targetLanguage,
      ttsServiceType: ttsServiceType,
      latency: {
        total: totalLatency,
        serverCompleteTime: currentTime,
        components: {
          translation: latencyTracking.components.translation,
          tts: latencyTracking.components.tts,
          processing: latencyTracking.components.processing,
          network: 0
        }
      }
    };
  }
  
  /**
   * Add audio data to a translation message
   */
  private addAudioDataToMessage(
    translationMessage: TranslationMessageToClient,
    audioBuffer: Buffer,
    studentLanguage: string,
    translatedText: string,
    ttsServiceType: string
  ): void {
    try {
      // Check if this is a special marker for browser speech synthesis
      const bufferString = audioBuffer.toString('utf8');
      
      if (bufferString.startsWith('{"type":"browser-speech"')) {
        // This is a marker for browser-based speech synthesis
        logger.info(`Using client browser speech synthesis for ${studentLanguage}`);
        translationMessage.useClientSpeech = true;
        try {
          translationMessage.speechParams = JSON.parse(bufferString);
          logger.info(`Successfully parsed speech params for ${studentLanguage}`);
        } catch (jsonError) {
          logger.error('Error parsing speech params:', { jsonError });
          translationMessage.speechParams = {
            type: 'browser-speech',
            text: translatedText,
            languageCode: studentLanguage,
            autoPlay: true
          };
        }
      } else if (audioBuffer.length > 0) {
        // This is actual audio data - encode as base64
        translationMessage.audioData = audioBuffer.toString('base64');
        translationMessage.useClientSpeech = false; // Explicitly set to false
        
        // Log audio data details for debugging
        logger.debug(`Sending ${audioBuffer.length} bytes of audio data to client`);
        logger.debug(`Using OpenAI TTS service for ${studentLanguage} (teacher preference: ${ttsServiceType})`);
        logger.debug(`First 16 bytes of audio: ${Array.from(audioBuffer.slice(0, 16)).map(b => b.toString(16).padStart(2, '0')).join(' ')}`);
      } else {
        // Log a warning when no audio data is available
        logger.warn(`Warning: No audio buffer available for language ${studentLanguage} with TTS service ${ttsServiceType}`);
      }
    } catch (error) {
      logger.error('Error processing audio data for translation:', { error });
    }
  }
  
  /**
   * Handle audio message
   */
  private async handleAudioMessage(ws: WebSocketClient, message: AudioMessageToServer): Promise<void> {
    const role = this.roles.get(ws);
    
    // Only process audio from teacher
    if (role !== 'teacher') {
      logger.info('Ignoring audio from non-teacher role:', { role });
      return;
    }
    
    // Process audio data
    if (message.data) {
      await this.processTeacherAudio(ws, message.data);
    }
  }
  
  /**
   * Process audio from teacher
   */
  private async processTeacherAudio(ws: WebSocketClient, audioData: string): Promise<void> {
    // Validate audio data
    if (!audioData || audioData.length < 100) {
      return;
    }
    try {
      // Convert base64 to buffer
      const audioBuffer = Buffer.from(audioData, 'base64');
      if (audioBuffer.length < 100) {
        return;
      }
      const teacherLanguage = this.languages.get(ws) || 'en-US';
      const sessionId = this.sessionIds.get(ws);
      if (!sessionId) {
        logger.error('No session ID found for teacher');
        return;
      }
      // Comment out server-side transcription since we\'re using client-side speech recognition
      // The client sends both audio chunks and transcriptions separately
      /*
      // Transcribe the audio
      const transcription = await audioTranscriptionService.transcribeAudio(
        audioBuffer,
        teacherLanguage
      );
      console.log(\'Transcribed audio:\', transcription);
      // If we got a transcription, process it as a transcription message
      if (transcription && transcription.trim().length > 0) {
        await this.handleTranscriptionMessage(ws, {
          type: \'transcription\',
          text: transcription,
          timestamp: Date.now(),
          isFinal: true
        } as TranscriptionMessageToServer);
      }
      */
      // For now, just log that we received audio
      logger.debug('Received audio chunk from teacher, using client-side transcription');
    } catch (error) {
      logger.error('Error processing teacher audio:', { error });
    }
  }
  
  /**
   * Handle TTS request message
   */
  private async handleTTSRequestMessage(ws: WebSocketClient, message: TTSRequestMessageToServer): Promise<void> {
    const text = message.text;
    const languageCode = message.languageCode;
    
    if (!this.validateTTSRequest(text, languageCode)) {
      await this.sendTTSErrorResponse(ws, 'Invalid TTS request parameters');
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
          ws,
          text,
          languageCode,
          audioBuffer,
          ttsServiceType
        );
      } else {
        // Send error if no audio was generated
        await this.sendTTSErrorResponse(ws, 'Failed to generate audio');
      }
    } catch (error) {
      logger.error('Error handling TTS request:', { error });
      await this.sendTTSErrorResponse(ws, 'TTS generation error');
    }
  }
  
  /**
   * Validate TTS request parameters
   */
  private validateTTSRequest(text: string, languageCode: string): boolean {
    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      logger.error('Invalid TTS text:', { text });
      return false;
    }
    
    if (!languageCode || typeof languageCode !== 'string') {
      logger.error('Invalid TTS language code:', { languageCode });
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
      logger.error('Error generating TTS audio:', { error });
      return Buffer.from(''); // Return empty buffer on error
    }
  }
  
  /**
   * Send TTS response with audio data
   */
  private async sendTTSResponse(
    ws: WebSocketClient,
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
          logger.error('Error parsing speech params:', { error });
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
      ws.send(JSON.stringify(response as TTSResponseMessageToClient));
      logger.info(`TTS response sent successfully for language '${languageCode}'`);
    } catch (error) {
      logger.error('Error sending TTS response:', { error });
      // Try to send error message if possible
      try {
        await this.sendTTSErrorResponse(ws, 'Failed to send audio data');
      } catch (sendError) {
        logger.error('Error sending TTS error response:', { sendError });
      }
    }
  }
  
  /**
   * Send TTS error response
   */
  private async sendTTSErrorResponse(
    ws: WebSocketClient,
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
      
      ws.send(JSON.stringify(ttsErrorResponse));
      logger.error(`TTS error response sent: ${messageText}`);
    } catch (error) {
      logger.error('Error sending TTS error response:', { error });
    }
  }
  
  /**
   * Handle settings message
   */
  private handleSettingsMessage(ws: WebSocketClient, message: SettingsMessageToServer): void {
    const role = this.roles.get(ws);
    
    // Initialize settings for this client if not already present
    const settings: ClientSettings = this.clientSettings.get(ws) || {};
    
    // Update settings with new values
    if (message.settings) {
      Object.assign(settings, message.settings);
    }
    
    // Special handling for ttsServiceType since it can be specified outside settings object
    if (message.ttsServiceType) {
      settings.ttsServiceType = message.ttsServiceType;
      logger.info(`Updated TTS service type for ${role} to: ${settings.ttsServiceType}`);
    }
    
    // Store updated settings
    this.clientSettings.set(ws, settings);
    
    // Send confirmation
    const response: SettingsResponseToClient = {
      type: 'settings',
      status: 'success',
      settings
    };
    
    ws.send(JSON.stringify(response));
  }
  
  /**
   * Handle ping message
   */
  private handlePingMessage(ws: WebSocketClient, message: PingMessageToServer): void {
    // Mark as alive for heartbeat
    ws.isAlive = true;
    
    // Send pong response
    const response: PongMessageToClient = {
      type: 'pong',
      timestamp: Date.now(),
      originalTimestamp: message.timestamp
    };
    
    try {
      ws.send(JSON.stringify(response));
    } catch (error) {
      logger.error('Error sending pong response:', { error });
    }
  }
  
  /**
   * Handle WebSocket close event
   */
  private handleClose(ws: WebSocketClient): void {
    const sessionId = this.sessionIds.get(ws);
    logger.info('WebSocket disconnected, sessionId:', { sessionId });
    
    // Remove from tracking
    this.connections.delete(ws);
    this.roles.delete(ws);
    this.languages.delete(ws);
    this.sessionIds.delete(ws);
    this.clientSettings.delete(ws);
    
    // End session in storage if no more connections with this sessionId
    if (sessionId) {
      const hasOtherConnections = Array.from(this.sessionIds.values()).includes(sessionId);
      if (!hasOtherConnections) {
        this.endSessionInStorage(sessionId).catch(error => {
          logger.error('Failed to end session in storage:', { error });
        });
      }
    }
  }
  
  /**
   * End session in storage
   */
  private async endSessionInStorage(sessionId: string): Promise<void> {
    try {
      await storage.endSession(sessionId);
    } catch (error) {
      logger.error('Failed to end session in storage:', { error });
    }
  }
  
  /**
   * Set up heartbeat mechanism to detect dead connections
   */
  private setupHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      this.wss.clients.forEach((ws: any) => {
        const client = ws as WebSocketClient;
        
        if (!client.isAlive) {
          logger.info('Terminating dead connection', { sessionId: client.sessionId });
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
  public getConnections(): Set<WebSocketClient> {
    return this.connections;
  }
  
  /**
   * Get connection role
   */
  public getRole(client: WebSocketClient): string | undefined {
    return this.roles.get(client);
  }
  
  /**
   * Get connection language
   */
  public getLanguage(client: WebSocketClient): string | undefined {
    return this.languages.get(client);
  }
  
  /**
   * Generate a classroom code for a session
   */
  private generateClassroomCode(sessionId: string): string {
    // Check if we already have a code for this session
    for (const [code, session] of this.classroomSessions.entries()) {
      if (session.sessionId === sessionId) {
        // Update activity and return existing code
        session.lastActivity = Date.now();
        session.teacherConnected = true;
        return code;
      }
    }
    
    // Generate new 6-character code
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code: string;
    
    // Ensure uniqueness
    do {
      code = '';
      for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
      }
    } while (this.classroomSessions.has(code));
    
    // Create session with 2-hour expiration
    const session: ClassroomSession = {
      code,
      sessionId,
      createdAt: Date.now(),
      lastActivity: Date.now(),
      teacherConnected: true,
      expiresAt: Date.now() + (2 * 60 * 60 * 1000) // 2 hours
    };
    
    this.classroomSessions.set(code, session);
    logger.info(`Created new classroom session: ${code} for session ${sessionId}`);
    
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
    
    const session = this.classroomSessions.get(code);
    if (!session) {
      return false;
    }
    
    // Check expiration
    if (Date.now() > session.expiresAt) {
      this.classroomSessions.delete(code);
      logger.info(`Classroom code ${code} expired and removed`);
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
      
      for (const [code, session] of this.classroomSessions.entries()) {
        if (now > session.expiresAt) {
          this.classroomSessions.delete(code);
          cleaned++;
        }
      }
      
      if (cleaned > 0) {
        logger.info(`Cleaned up ${cleaned} expired classroom sessions`);
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

  /**
   * Get active session metrics for diagnostics
   */
  getActiveSessionMetrics() {
    const activeSessions = new Set<string>();
    let studentsConnected = 0;
    let teachersConnected = 0;
    const currentLanguages = new Set<string>();

    for (const connection of this.connections.values()) {
      const sessionId = this.sessionIds.get(connection);
      const role = this.roles.get(connection);
      const language = this.languages.get(connection);
      
      if (sessionId) {
        // Find classroom code for this session
        for (const [code, session] of this.classroomSessions.entries()) {
          if (session.sessionId === sessionId) {
            activeSessions.add(code);
            break;
          }
        }
      }
      
      if (role === 'student') {
        studentsConnected++;
      } else if (role === 'teacher') {
        teachersConnected++;
        if (language) {
          currentLanguages.add(language);
        }
      }
    }

    return {
      activeSessions: activeSessions.size,
      studentsConnected,
      teachersConnected,
      currentLanguages: Array.from(currentLanguages)
    };
  }

  // Method to gracefully shut down the WebSocket server
  public shutdown(): void {
    logger.info('[WebSocketServer] Shutting down...');

    // 1. Clear intervals
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
      logger.info('[WebSocketServer] Heartbeat interval cleared.');
    }
    if (this.classroomCleanupInterval) {
      clearInterval(this.classroomCleanupInterval);
      this.classroomCleanupInterval = null;
      logger.info('[WebSocketServer] Classroom cleanup interval cleared.');
    }

    // 2. Close all client connections
    logger.info(`[WebSocketServer] Closing ${this.connections.size} client connections...`);
    this.connections.forEach(client => {
      client.terminate();
    });
    logger.info('[WebSocketServer] All client connections terminated.');

    // 3. Clear internal maps and sets
    this.connections.clear();
    this.roles.clear();
    this.languages.clear();
    this.sessionIds.clear();
    this.clientSettings.clear();
    this.classroomSessions.clear();
    logger.info('[WebSocketServer] Internal maps and sets cleared.');

    // 4. Close the underlying WebSocket server instance
    if (this.wss) {
      this.wss.close((err) => {
        if (err) {
          logger.error('[WebSocketServer] Error closing WebSocket server:', { err });
        } else {
          logger.info('[WebSocketServer] WebSocket server closed.');
        }
      });
    }
    
    // 5. Unsubscribe from HTTP server 'upgrade' events if we were listening
    // This depends on how the server was attached. If it was passed in and WSS handles it,
    // then wss.close() should be enough. If manual listeners were added, they need removal.
    // Assuming wss.close() handles detaching from the httpServer for now.

    logger.info('[WebSocketServer] Shutdown complete.');
  }
}