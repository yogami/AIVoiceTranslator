/**
 * Real-Time Translation Application Service
 * 
 * This is the main application service that orchestrates real-time translation
 * communication. It's protocol-agnostic and follows SOLID principles.
 * 
 * This replaces the monolithic WebSocketServer with clean architecture:
 * - Protocol abstraction for easy WebSocket → WebRTC migration
 * - Clear separation of concerns
 * - Dependency injection for testability
 * - Event-driven architecture
 * 
 * SOLID Principles:
 * - Single Responsibility: Translation communication orchestration
 * - Open/Closed: Extensible without modification
 * - Liskov Substitution: Any protocol implementation works
 * - Interface Segregation: Focused interfaces
 * - Dependency Inversion: Depends on abstractions
 */

import logger from '../../logger';
import { IStorage } from '../../storage.interface';
import { 
  IConnection,
  ICommunicationProtocol
} from './ICommunicationProtocol';
import { 
  IRealTimeCommunicationService,
  RealTimeCommunicationService 
} from './RealTimeCommunicationService';
import { IActiveSessionProvider } from '../session/IActiveSessionProvider';
import { SessionService } from '../session/SessionService';
import { SpeechPipelineOrchestrator } from '../SpeechPipelineOrchestrator';
import { getTranslationService } from '../translation/TranslationServiceFactory';
import { getTTSService } from '../tts/TTSServiceFactory';
import { audioTranscriptionService } from '../stttranscription/AudioTranscriptionService';

export interface ITranslationApplicationService extends IActiveSessionProvider {
  start(): Promise<void>;
  stop(): Promise<void>;
  switchProtocol(protocol: ICommunicationProtocol): Promise<void>;
  getCurrentProtocol(): string;
  
  // For backward compatibility with tests
  getConnections(): IConnection[];
  broadcastStudentCount(sessionId: string): Promise<void>;
}

export class TranslationApplicationService implements ITranslationApplicationService {
  private communicationService: IRealTimeCommunicationService;
  private sessionService: SessionService;
  private speechPipelineOrchestrator: SpeechPipelineOrchestrator;
  private messageRegistry = new Map<string, (connection: IConnection, message: any) => Promise<void>>();

  constructor(
    protocol: ICommunicationProtocol,
    private storage: IStorage,
    httpServer?: any,
    options?: any
  ) {
    this.communicationService = new RealTimeCommunicationService(
      protocol,
      storage,
      httpServer,
      options
    );
    
    this.sessionService = new SessionService(storage);
    this.speechPipelineOrchestrator = this.createSpeechPipelineOrchestrator();
    
    this.setupEventHandlers();
    this.setupMessageHandlers();
  }

  async start(): Promise<void> {
    await this.communicationService.start();
    logger.info('TranslationApplicationService started');
  }

  async stop(): Promise<void> {
    await this.communicationService.stop();
    logger.info('TranslationApplicationService stopped');
  }

  async switchProtocol(protocol: ICommunicationProtocol): Promise<void> {
    await this.communicationService.switchProtocol(protocol);
    logger.info(`Switched to protocol: ${protocol.name}`);
  }

  getCurrentProtocol(): string {
    return this.communicationService.getCurrentProtocol();
  }

  // IActiveSessionProvider implementation
  getActiveSessionCount(): number {
    return this.communicationService.getConnections().length;
  }

  getActiveSessionsCount(): number {
    const sessions = new Set(
      this.communicationService.getConnections()
        .map(conn => conn.sessionId)
        .filter(sessionId => sessionId)
    );
    return sessions.size;
  }

  getActiveStudentCount(): number {
    return this.communicationService.getActiveStudentCount();
  }

  getActiveTeacherCount(): number {
    return this.communicationService.getActiveTeacherCount();
  }

  // Backward compatibility methods
  getConnections(): IConnection[] {
    return this.communicationService.getConnections();
  }

  async broadcastStudentCount(sessionId: string): Promise<void> {
    const studentCount = this.getActiveStudentCount();
    const message = {
      type: 'studentCountUpdate',
      count: studentCount
    };

    await this.communicationService.broadcastToSession(sessionId, message);
    logger.info(`Broadcasted student count update: ${studentCount} to session ${sessionId}`);
  }

  private setupEventHandlers(): void {
    this.communicationService.onConnection((connection) => {
      this.handleNewConnection(connection);
    });

    this.communicationService.onDisconnection((connection) => {
      this.handleConnectionClose(connection);
    });

    this.communicationService.onMessage((connection, message) => {
      this.handleMessage(connection, message);
    });
  }

  private setupMessageHandlers(): void {
    this.messageRegistry.set('register', this.handleRegisterMessage.bind(this));
    this.messageRegistry.set('transcription', this.handleTranscriptionMessage.bind(this));
    this.messageRegistry.set('audio', this.handleAudioMessage.bind(this));
    this.messageRegistry.set('settings', this.handleSettingsMessage.bind(this));
    this.messageRegistry.set('ping', this.handlePingMessage.bind(this));
    this.messageRegistry.set('pong', this.handlePongMessage.bind(this));
    this.messageRegistry.set('ttsRequest', this.handleTTSRequestMessage.bind(this));
  }

  private async handleNewConnection(connection: IConnection): Promise<void> {
    logger.info('New connection established:', { connectionId: connection.id });
    
    // Send connection acknowledgment
    await connection.send(JSON.stringify({
      type: 'connection',
      connectionId: connection.id,
      timestamp: new Date().toISOString()
    }));
  }

  private async handleConnectionClose(connection: IConnection): Promise<void> {
    logger.info('Connection closed:', { 
      connectionId: connection.id,
      sessionId: connection.sessionId,
      role: connection.role 
    });

    // Broadcast student count update if this was a student
    if (connection.role === 'student' && connection.sessionId) {
      await this.broadcastStudentCount(connection.sessionId);
    }
  }

  private async handleMessage(connection: IConnection, message: any): Promise<void> {
    try {
      const handler = this.messageRegistry.get(message.type);
      if (handler) {
        await handler(connection, message);
      } else {
        logger.warn('Unknown message type:', { type: message.type, connectionId: connection.id });
      }
    } catch (error) {
      logger.error('Error handling message:', { 
        error, 
        messageType: message.type, 
        connectionId: connection.id 
      });
      
      // Send error response
      await connection.send(JSON.stringify({
        type: 'error',
        message: 'Message processing failed',
        originalType: message.type
      }));
    }
  }

  private async handleRegisterMessage(connection: IConnection, message: any): Promise<void> {
    // Set connection metadata
    connection.role = message.role;
    connection.sessionId = message.sessionId;
    connection.language = message.language;
    
    // For teacher registration, we might need to handle session creation
    // but SessionService doesn't have createSession method currently
    if (message.role === 'teacher') {
      // The session creation is handled elsewhere in the application
      logger.info('Teacher registered:', { 
        sessionId: message.sessionId,
        classroomCode: message.classroomCode 
      });
    }

    // Send registration response
    const response: any = {
      type: 'registerResponse',
      success: true,
      connectionId: connection.id,
      sessionId: connection.sessionId,
      role: connection.role
    };

    if (message.role === 'teacher') {
      response.classroomCode = message.classroomCode;
    }

    await connection.send(JSON.stringify(response));
    
    // Broadcast student count update
    if (connection.sessionId) {
      await this.broadcastStudentCount(connection.sessionId);
    }

    logger.info('Client registered:', { 
      connectionId: connection.id,
      role: connection.role,
      sessionId: connection.sessionId 
    });
  }

  private async handleTranscriptionMessage(connection: IConnection, message: any): Promise<void> {
    if (!connection.sessionId) {
      throw new Error('Connection not registered');
    }

    // Process transcription through speech pipeline
    const startTime = Date.now();
    
    // Create audio buffer from message data
    const audioBuffer = Buffer.from(message.audioData, 'base64');
    
    const result = await this.speechPipelineOrchestrator.process(
      audioBuffer,
      message.sourceLanguage,
      message.targetLanguage,
      message.preTranscribedText,
      { ttsServiceType: message.ttsServiceType || 'auto' }
    );

    // Calculate latency
    const latency = {
      start: startTime,
      components: {
        preparation: Date.now() - startTime,
        translation: 0, // Will be updated by orchestrator
        tts: 0, // Will be updated by orchestrator  
        processing: Date.now() - startTime
      }
    };

    // Send translation to all students in the session
    const translationMessage = {
      type: 'translation',
      originalText: result.originalText,
      translatedText: result.translatedText,
      sourceLanguage: message.sourceLanguage,
      targetLanguage: message.targetLanguage,
      audioData: result.audioBuffer.toString('base64'),
      latency,
      timestamp: new Date().toISOString()
    };

    await this.communicationService.broadcastToSession(connection.sessionId, translationMessage);
    
    logger.info('Translation processed and broadcasted:', {
      sessionId: connection.sessionId,
      originalText: result.originalText,
      translatedText: result.translatedText
    });
  }

  private async handleAudioMessage(connection: IConnection, message: any): Promise<void> {
    // Handle audio transcription request
    if (!connection.sessionId) {
      throw new Error('Connection not registered');
    }

    // This is typically handled by the transcription message
    // but could be separate for real-time audio streaming
    logger.info('Audio message received:', { 
      connectionId: connection.id,
      sessionId: connection.sessionId 
    });
  }

  private async handleSettingsMessage(connection: IConnection, message: any): Promise<void> {
    // Update connection settings
    connection.settings = { ...connection.settings, ...message.settings };
    
    // Send settings response
    await connection.send(JSON.stringify({
      type: 'settingsResponse',
      success: true,
      settings: connection.settings
    }));

    logger.info('Settings updated:', { 
      connectionId: connection.id,
      settings: connection.settings 
    });
  }

  private async handlePingMessage(connection: IConnection, message: any): Promise<void> {
    // Respond with pong
    await connection.send(JSON.stringify({
      type: 'pong',
      timestamp: message.timestamp
    }));
  }

  private async handlePongMessage(connection: IConnection, message: any): Promise<void> {
    // Handle pong response (for heartbeat)
    logger.debug('Pong received:', { connectionId: connection.id });
  }

  private async handleTTSRequestMessage(connection: IConnection, message: any): Promise<void> {
    // Handle TTS request
    const ttsService = getTTSService(message.serviceType || 'auto');
    const result = await ttsService.synthesize(
      message.text,
      { language: message.targetLanguage }
    );

    await connection.send(JSON.stringify({
      type: 'ttsResponse',
      requestId: message.requestId,
      audioData: result.audioBuffer.toString('base64')
    }));

    logger.info('TTS request processed:', { 
      connectionId: connection.id,
      text: message.text,
      serviceType: message.serviceType 
    });
  }

  private createSpeechPipelineOrchestrator(): SpeechPipelineOrchestrator {
    const sttService = {
      transcribe: (audioBuffer: Buffer, sourceLanguage: string) =>
        audioTranscriptionService.transcribeAudio(audioBuffer, sourceLanguage)
    };
    
    const translationService = getTranslationService();
    const ttsServiceFactory = (type: string) => getTTSService(type);
    
    return new SpeechPipelineOrchestrator(
      sttService,
      translationService,
      ttsServiceFactory
    );
  }
}
