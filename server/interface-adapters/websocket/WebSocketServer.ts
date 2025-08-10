/**
 * PRIMARY WebSocket Server Implementation
 * 
 * SOLID Refactored: Focused on WebSocket connection management and message routing only.
 * Speech processing (STT/Translation/TTS) logic moved to SpeechPipelineOrchestrator.
 * 
 * IMPORTANT: This is the implementation currently used by server.ts
 */
import { WebSocketServer as WSServer, WebSocket } from 'ws';
import * as http from 'http';
import logger from '../../logger';
import { config } from '../../config';
import { URL } from 'url';

import { IActiveSessionProvider } from '../../application/services/session/IActiveSessionProvider';
import { ConnectionManager, type WebSocketClient } from './websocket-services/ConnectionManager';
import { SessionService, type ClassroomSession } from '../../application/services/session/SessionService';
import { SpeechPipelineOrchestrator } from '../../application/services/SpeechPipelineOrchestrator';
import { ClassroomSessionManager } from '../../application/services/session/ClassroomSessionManager';
import { StorageSessionManager } from '../../application/services/session/StorageSessionManager';
import { ConnectionHealthManager } from './websocket-services/ConnectionHealthManager';
import { ConnectionLifecycleManager } from './websocket-services/ConnectionLifecycleManager';
import { ConnectionValidationService } from './websocket-services/ConnectionValidationService';
import { SessionMetricsService } from '../../application/services/session/SessionMetricsService';
import { WebSocketResponseService } from './websocket-services/WebSocketResponseService';
import { SessionLifecycleService } from '../../application/services/session/SessionLifecycleService';
import { SessionCountCacheService } from '../../application/services/session/SessionCountCacheService';
import { 
  MessageHandlerRegistry, 
  MessageDispatcher, 
  MessageHandlerContext 
} from './websocket-services/MessageHandler';
import { RegisterMessageHandler } from './websocket-services/RegisterMessageHandler';
import { PingMessageHandler } from './websocket-services/PingMessageHandler';
import { SettingsMessageHandler } from './websocket-services/SettingsMessageHandler';
import { TranscriptionMessageHandler } from './websocket-services/TranscriptionMessageHandler';
import { TTSRequestMessageHandler } from './websocket-services/TTSRequestMessageHandler';
import { AudioMessageHandler } from './websocket-services/AudioMessageHandler';
import { PongMessageHandler } from './websocket-services/PongMessageHandler';
import type {
  ClientSettings,
  WebSocketMessageToServer,
  RegisterMessageToServer,
  TranscriptionMessageToServer,
  AudioMessageToServer,
  TTSRequestMessageToServer,
  SettingsMessageToServer,
  PingMessageToServer,
  ConnectionMessageToClient,
  ClassroomCodeMessageToClient,
  RegisterResponseToClient,
  TranslationMessageToClient,
  SettingsResponseToClient,
  PongMessageToClient,
  ErrorMessageToClient,
  StudentJoinedMessageToClient
} from './WebSocketTypes';
import { IStorage } from '../../storage.interface';
import { UnifiedSessionCleanupService } from '../../application/services/session/cleanup/UnifiedSessionCleanupService';

/**
 * WebSocketServer - SOLID Refactored
 * 
 * Single Responsibility: WebSocket connection management and message routing
 * Open/Closed: Extensible through message handlers and service injection
 * Liskov Substitution: Implements IActiveSessionProvider contract
 * Interface Segregation: Depends only on necessary interfaces
 * Dependency Inversion: Depends on abstractions, not concretions
 */
export class WebSocketServer implements IActiveSessionProvider {
  private wss: WSServer;
  private storage: IStorage;
  
  // WebSocket and Connection Management (Core Responsibility)
  private connectionManager!: ConnectionManager;
  private connectionHealthManager!: ConnectionHealthManager;
  private connectionLifecycleManager!: ConnectionLifecycleManager;
  private connectionValidationService!: ConnectionValidationService;
  private webSocketResponseService!: WebSocketResponseService;
  
  // Session Management Services
  private sessionService!: SessionService;
  private classroomSessionManager!: ClassroomSessionManager;
  private storageSessionManager!: StorageSessionManager;
  private sessionMetricsService!: SessionMetricsService;
  private sessionLifecycleService!: SessionLifecycleService;
  private sessionCountCacheService!: SessionCountCacheService;
  private unifiedSessionCleanupService!: UnifiedSessionCleanupService;
  
  // Speech Processing (Injected, not created)
  private speechPipelineOrchestrator: SpeechPipelineOrchestrator;
  
  // Message Handling Infrastructure
  private messageHandlerRegistry!: MessageHandlerRegistry;
  private messageDispatcher!: MessageDispatcher;
  
  // Instance tracking for cleanup
  private static instances: Set<WebSocketServer> = new Set();
  private isShutdown = false;
  private heartbeatInterval: NodeJS.Timeout | null = null;

  /**
   * Constructor with Dependency Injection
   * @param server HTTP server
   * @param storage Data storage interface
   * @param speechPipelineOrchestrator Injected speech processing orchestrator
   */
  constructor(
    server: http.Server, 
    storage: IStorage, 
    speechPipelineOrchestrator?: SpeechPipelineOrchestrator
  ) { 
    // Register this instance for cleanup tracking
    WebSocketServer.instances.add(this);
    
    // Core initialization
    this.wss = new WSServer({ server });
    this.storage = storage;
    
    // SOLID: Dependency Injection - use provided orchestrator or create with defaults
    this.speechPipelineOrchestrator = speechPipelineOrchestrator || SpeechPipelineOrchestrator.createWithDefaultServices();
    
    // Initialize services in dependency order
    this.initializeCoreServices(storage);
    this.initializeMessageHandling();
    this.initializeConnectionLifecycle();
    
    // Set up event handlers
    this.setupEventHandlers();
    
    // Start background services
    this.startBackgroundServices();
  }

  /**
   * Initialize core services that other services depend on
   */
  private initializeCoreServices(storage: IStorage): void {
    this.connectionManager = new ConnectionManager();
    this.connectionHealthManager = new ConnectionHealthManager(this.wss);
    this.sessionService = new SessionService(storage);
    this.classroomSessionManager = new ClassroomSessionManager();
    this.storageSessionManager = new StorageSessionManager(storage);
    
    // Initialize specialized services
    this.connectionValidationService = new ConnectionValidationService(this.classroomSessionManager);
    this.sessionMetricsService = new SessionMetricsService(this.connectionManager, this.classroomSessionManager);
    this.webSocketResponseService = new WebSocketResponseService();
    this.sessionLifecycleService = new SessionLifecycleService(storage);
    this.sessionCountCacheService = new SessionCountCacheService(storage);
    
    // Initialize unified cleanup service with SOLID architecture
    this.unifiedSessionCleanupService = new UnifiedSessionCleanupService(
      storage, 
      this.classroomSessionManager.getAllSessions()
    );
  }

  /**
   * Initialize message handling infrastructure
   */
  private initializeMessageHandling(): void {
    this.messageHandlerRegistry = new MessageHandlerRegistry();
    
    // Register message handlers (they know their own message type)
    this.messageHandlerRegistry.register(new RegisterMessageHandler());
    this.messageHandlerRegistry.register(new PingMessageHandler());
    this.messageHandlerRegistry.register(new SettingsMessageHandler());
    this.messageHandlerRegistry.register(new TranscriptionMessageHandler());
    this.messageHandlerRegistry.register(new AudioMessageHandler());
    this.messageHandlerRegistry.register(new TTSRequestMessageHandler());
    this.messageHandlerRegistry.register(new PongMessageHandler());
    
    // Create message handler context with all required services
    const messageHandlerContext: Omit<MessageHandlerContext, 'ws'> = {
      connectionManager: this.connectionManager,
      storage: this.storage,
      sessionService: this.sessionService,
      translationService: null, // Legacy service - may not be needed for newer handlers
      speechPipelineOrchestrator: this.speechPipelineOrchestrator,
      sessionLifecycleService: this.sessionLifecycleService,
      webSocketServer: this
    };
    
    // Initialize message dispatcher with context
    this.messageDispatcher = new MessageDispatcher(this.messageHandlerRegistry, messageHandlerContext as MessageHandlerContext);
  }

  /**
   * REMOVED: Speech processing configuration moved to SpeechPipelineOrchestrator.createWithDefaultServices()
   * This follows SOLID principles - WebSocketServer no longer responsible for STT/Translation/TTS configuration
   */

  /**
   * Initialize connection lifecycle management
   */
  private initializeConnectionLifecycle(): void {
    this.connectionLifecycleManager = new ConnectionLifecycleManager(
      this.connectionManager,
      this.classroomSessionManager,
      this.storageSessionManager,
      this.connectionHealthManager,
      this.messageDispatcher,
      this
    );
  }

  /**
   * Start background services and tasks
   */
  private startBackgroundServices(): void {
    this.startSessionLifecycleManagement();
    this.sessionCountCacheService.start();
    this.unifiedSessionCleanupService.start();

  }


  /**
   * Get the number of active WebSocket connections.
   * Implements IActiveSessionProvider.
   * @returns The number of active connections.
   */
  public getActiveSessionCount(): number {
    return this.connectionManager.getConnectionCount();
  }

  /**
   * Get the number of active sessions (actual classroom sessions from database).
   * Implements IActiveSessionProvider.
   * @returns The number of active sessions.
   */
  public getActiveSessionsCount(): number { // Renamed from getActiveSessionCount to getActiveSessionsCount
    // Return cached database session count for accuracy
    return this.sessionCountCacheService.getActiveSessionCount();
  }

  /**
   * Get the number of active student connections.
   * Implements IActiveSessionProvider.
   * @returns The number of active student connections.
   */
  public getActiveStudentCount(): number {
    return this.connectionManager.getStudentCount();
  }

  /**
   * Get the number of active teacher connections.
   * Implements IActiveSessionProvider.
   * @returns The number of active teacher connections.
   */
  public getActiveTeacherCount(): number {
    return this.connectionManager.getTeacherCount();
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
    
    // Note: Heartbeat is now handled by ConnectionHealthManager
  }
  
  /**
   * Handle new WebSocket connection
   */
  private handleConnection(ws: WebSocketClient, request?: any): void {
    logger.info('New WebSocket connection established');
    
    this.initializeNewConnectionLifecycle(ws, request);
    this.setupConnectionEventHandlers(ws);
  }

  /**
   * Initialize connection lifecycle for new connection
   */
  private initializeNewConnectionLifecycle(ws: WebSocketClient, request?: any): void {
    this.connectionLifecycleManager.handleConnection(ws, request).catch(error => {
      logger.error('Error in connection lifecycle handling:', { error });
    });
  }

  /**
   * Set up event handlers for WebSocket connection
   */
  private setupConnectionEventHandlers(ws: WebSocketClient): void {
    ws.on('message', (data: any) => {
      this.handleMessage(ws, data.toString());
    });
    
    ws.on('close', () => {
      this.connectionLifecycleManager.handleConnectionClose(ws);
    });
    
    ws.on('error', (error) => {
      logger.error('WebSocket error:', { error });
    });
  }

  /**
   * Handle incoming WebSocket message
   */
  async handleMessage(ws: WebSocketClient, data: string): Promise<void> {
    const messageContext = this.parseMessageContext(data);
    
    try {
      await this.processMessage(ws, data, messageContext);
      // Only update activity for audio when session is stable (has a DB-backed session)
      if (messageContext.type === 'audio') {
        const sid = this.connectionManager.getSessionId(ws);
        if (!sid) return;
        // Throttle activity updates for audio to avoid excessive DB writes
        const now = Date.now();
        if (!this.shouldUpdateActivity(ws, now)) return;
        await this.updateSessionActivity(sid);
        this.markActivityUpdated(ws, now);
      } else if (messageContext.type !== 'register') {
        // Avoid updating activity for immediate register ack which can race before persistence
        await this.updateActivityIfNeeded(ws, messageContext.type);
      }
    } catch (error) {
      logger.error('Message handling error:', { error, type: messageContext.type, sessionId: messageContext.sessionId });
    }
  }

  /**
   * Parse message context for processing
   */
  private parseMessageContext(data: string): { type: string; sessionId?: string } {
    try {
      const messageData = JSON.parse(data);
      const type = messageData.type || 'unknown';
      
      // Log non-ping/pong messages for debugging
      if (type !== 'ping' && type !== 'pong' && type !== 'audio') {
        const sessionId = messageData.sessionId || 'none';
        logger.debug('Handling message', { type, sessionId });
        return { type, sessionId };
      }
      
      return { type };
    } catch (error) {
      return { type: 'unknown' };
    }
  }

  /**
   * Process message through dispatcher
   */
  private async processMessage(ws: WebSocketClient, data: string, context: { type: string }): Promise<void> {
    await this.messageDispatcher.dispatch(ws, data);
  }

  /**
   * Update session activity for meaningful message types
   */
  private async updateActivityIfNeeded(ws: WebSocketClient, messageType: string): Promise<void> {
    const activityUpdateMessages = ['transcription', 'audio', 'settings'];
    if (activityUpdateMessages.includes(messageType)) {
      const sessionId = this.connectionManager.getSessionId(ws);
      if (sessionId) {
        await this.updateSessionActivity(sessionId);
      }
    }
  }
  
  /**
   * Get all student connections and their unique languages
   */
  

  

  
  /**
   * Get connections
   */
  public getConnections(): Set<WebSocketClient> {
    return this.connectionManager.getConnections();
  }
  
  /**
   * Get connection language
   */
  public getLanguage(client: WebSocketClient): string | undefined {
    return this.connectionManager.getLanguage(client);
  }
   
  /**
   * Close WebSocket server
   */
  public async close(): Promise<void> {
    logger.info('[WebSocketServer] Closing WebSocket server...');

    try {
      // 1. Stop unified session cleanup service
      if (this.unifiedSessionCleanupService) {
        this.unifiedSessionCleanupService.stop();
        logger.info('[WebSocketServer] UnifiedSessionCleanupService stopped.');
      }

      // 2. Close all WebSocket connections
      this.wss.clients.forEach((ws) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.close(1000, 'Server shutting down');
        }
      });

      // 3. Close the WebSocket server
      await new Promise<void>((resolve, reject) => {
        this.wss.close((err) => {
          if (err) {
            logger.error('[WebSocketServer] Error closing WebSocket server:', { error: err });
            reject(err);
          } else {
            logger.info('[WebSocketServer] WebSocket server closed successfully.');
            resolve();
          }
        });
      });

      // 4. Clear classroom sessions
      this.classroomSessionManager.shutdown();
      logger.info('[WebSocketServer] ClassroomSessionManager shutdown completed.');

    } catch (error) {
      logger.error('[WebSocketServer] Error during close:', { error });
      throw error;
    }
  }
  
  /**
   * Generate a unique session ID
   */
  /**
   * Get active session metrics for diagnostics
   */
  getActiveSessionMetrics() {
    return this.sessionMetricsService.calculateActiveSessionMetrics();
  }

  // Method to gracefully shut down the WebSocket server
  public shutdown(): void {
    // Prevent multiple shutdowns
    if (this.isShutdown) {
      logger.warn('[WebSocketServer] Shutdown already in progress or completed.');
      return;
    }
    this.isShutdown = true;
    
    logger.info('[WebSocketServer] Shutting down...');

    // Unregister from static registry
    WebSocketServer.instances.delete(this);

    // 1. Clear intervals
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
      logger.info('[WebSocketServer] Heartbeat interval cleared.');
    }

    if (this.lifecycleCleanupInterval) {
      clearInterval(this.lifecycleCleanupInterval);
      this.lifecycleCleanupInterval = null;
      logger.info('[WebSocketServer] Session lifecycle interval cleared.');
    }

    if (this.sessionCountCacheService) {
      this.sessionCountCacheService.stop();
      logger.info('[WebSocketServer] Session count cache service stopped.');
    }

    if (this.unifiedSessionCleanupService) {
      this.unifiedSessionCleanupService.stop();
      logger.info('[WebSocketServer] Unified session cleanup service stopped.');
    }

    // 2. Shutdown SessionService
    this.sessionService.shutdown();
    logger.info('[WebSocketServer] SessionService shutdown completed.');

    // 2.1. UnifiedSessionCleanupService already stopped above

    // 3. Close all client connections
    const connections = this.connectionManager.getConnections();
    logger.info(`[WebSocketServer] Closing ${connections.size} client connections...`);
    connections.forEach(client => {
      client.terminate();
    });
    logger.info('[WebSocketServer] All client connections terminated.');

    // 4. Clear internal maps and sets
    this.connectionManager.clearAll();
    this.classroomSessionManager.clearAll(); // Delegate to ClassroomSessionManager
    logger.info('[WebSocketServer] Internal maps and sets cleared.');

    // 5. Close the underlying WebSocket server instance
    if (this.wss) {
      this.wss.close((err) => {
        if (err) {
          logger.error('[WebSocketServer] Error closing WebSocket server:', { err });
        } else {
          logger.info('[WebSocketServer] WebSocket server closed.');
        }
      });
    }
    
    // 6. Unsubscribe from HTTP server 'upgrade' events if we were listening
    // This depends on how the server was attached. If it was passed in and WSS handles it,
    // then wss.close() should be enough. If manual listeners were added, they need removal.
    // Assuming wss.close() handles detaching from the httpServer for now.

    logger.info('[WebSocketServer] Shutdown complete.');
  }

  /**
   * Static method to shutdown all WebSocketServer instances
   * Useful for test cleanup and process exit handlers
   */
  public static shutdownAll(): void {
    logger.info(`[WebSocketServer] Shutting down ${WebSocketServer.instances.size} remaining instances...`);
    const instances = Array.from(WebSocketServer.instances);
    for (const instance of instances) {
      try {
        instance.shutdown();
      } catch (error) {
        logger.error('[WebSocketServer] Error during instance shutdown:', { error });
      }
    }
    logger.info('[WebSocketServer] All instances shutdown complete.');
  }

  // Connection management delegate methods for backward compatibility
  public get connections(): Set<WebSocketClient> {
    return this.connectionManager.getConnections();
  }

  public set connections(value: Set<WebSocketClient>) {
    this.connectionManager.clearAll();
    for (const connection of value) {
      const sessionId = connection.sessionId || `temp-${Date.now()}-${Math.random()}`;
      this.connectionManager.addConnection(connection, sessionId);
    }
  }

  public get roles(): Map<WebSocketClient, string> {
    const rolesMap = new Map<WebSocketClient, string>();
    for (const connection of this.connectionManager.getConnections()) {
      const role = this.connectionManager.getRole(connection);
      if (role) {
        rolesMap.set(connection, role);
      }
    }
    return rolesMap;
  }

  public set roles(value: Map<WebSocketClient, string>) {
    for (const [connection, role] of value) {
      this.connectionManager.setRole(connection, role);
    }
  }

  public get languages(): Map<WebSocketClient, string> {
    const languagesMap = new Map<WebSocketClient, string>();
    for (const connection of this.connectionManager.getConnections()) {
      const language = this.connectionManager.getLanguage(connection);
      if (language) {
        languagesMap.set(connection, language);
      }
    }
    return languagesMap;
  }

  public set languages(value: Map<WebSocketClient, string>) {
    for (const [connection, language] of value) {
      this.connectionManager.setLanguage(connection, language);
    }
  }

  public get sessionIds(): Map<WebSocketClient, string> {
    const sessionIdsMap = new Map<WebSocketClient, string>();
    for (const connection of this.connectionManager.getConnections()) {
      const sessionId = this.connectionManager.getSessionId(connection);
      if (sessionId) {
        sessionIdsMap.set(connection, sessionId);
      }
    }
    return sessionIdsMap;
  }

  public set sessionIds(value: Map<WebSocketClient, string>) {
    for (const [connection, sessionId] of value) {
      this.connectionManager.updateSessionId(connection, sessionId);
    }
  }

  public get clientSettings(): Map<WebSocketClient, ClientSettings> {
    const settingsMap = new Map<WebSocketClient, ClientSettings>();
    for (const connection of this.connectionManager.getConnections()) {
      const settings = this.connectionManager.getClientSettings(connection);
      if (settings) {
        settingsMap.set(connection, settings);
      }
    }
    return settingsMap;
  }

  public set clientSettings(value: Map<WebSocketClient, ClientSettings>) {
    for (const [connection, settings] of value) {
      this.connectionManager.setClientSettings(connection, settings);
    }
  }

  // Expose the ConnectionManager for direct testing access
  public get _connectionManager(): ConnectionManager {
    return this.connectionManager;
  }

  // Expose the ClassroomSessionManager for direct testing access
  public get _classroomSessionManager(): ClassroomSessionManager {
    return this.classroomSessionManager;
  }

  // Helper method for tests to add connections directly
  public _addTestConnection(ws: WebSocketClient, sessionId: string, role?: string, language?: string, settings?: ClientSettings): void {
    this.connectionManager.addConnection(ws, sessionId);
    if (role) this.connectionManager.setRole(ws, role);
    if (language) this.connectionManager.setLanguage(ws, language);
    if (settings) this.connectionManager.setClientSettings(ws, settings);
  }

  /**
   * Set up message handlers for different message types
   */
  private setupMessageHandlers(): void {
    // Register message handlers
    this.messageHandlerRegistry.register(new RegisterMessageHandler());
    this.messageHandlerRegistry.register(new PingMessageHandler());
    this.messageHandlerRegistry.register(new SettingsMessageHandler());
    this.messageHandlerRegistry.register(new TranscriptionMessageHandler());
    this.messageHandlerRegistry.register(new TTSRequestMessageHandler());
    this.messageHandlerRegistry.register(new AudioMessageHandler());
    this.messageHandlerRegistry.register(new PongMessageHandler());
    
    // Clean Architecture: All domain handlers now properly separated from transport layer
    // All handlers now use working message handlers instead of broken transport handlers
  }

  /**
   * Start session lifecycle management with SOLID architecture
   */
  public startSessionLifecycleManagement(): void {
    logger.info('[WebSocketServer] Starting session lifecycle management with SOLID cleanup architecture');
    
    // Start unified cleanup service - centralized SOLID architecture
    this.unifiedSessionCleanupService.start();
    
    logger.info('[WebSocketServer] Session lifecycle management started successfully');
  }

  /**
   * Get the unified session cleanup service
   */
  public getSessionCleanupService(): UnifiedSessionCleanupService | null {
    return this.unifiedSessionCleanupService || null;
  }

  /**
   * Update session activity using unified cleanup service
   */
  public async updateSessionActivity(sessionId: string): Promise<void> {
    await this.unifiedSessionCleanupService.updateSessionActivity(sessionId);
  }

  /**
   * Check if activity should be updated based on throttling
   */
  private shouldUpdateActivity(ws: WebSocketClient, now: number): boolean {
    const lastUpdate = (ws as any).lastActivityUpdate || 0;
    const throttleInterval = 30000; // 30 seconds
    return now - lastUpdate > throttleInterval;
  }

  /**
   * Mark activity as updated for throttling purposes
   */
  private markActivityUpdated(ws: WebSocketClient, timestamp: number): void {
    (ws as any).lastActivityUpdate = timestamp;
  }

  // Helper getter for tests to access connectionHealthManager
  public get _connectionHealthManager() {
    return this.connectionHealthManager;
  }

  /**
   * Broadcast student count update to all teachers in the session
   */
  public broadcastStudentCount(sessionId: string): void {
    const studentCount = this.connectionManager.getStudentCount();
    const message = {
      type: 'studentCountUpdate',
      count: studentCount
    };

    // Send to all teachers in the specified session
    const connections = this.connectionManager.getConnections();
    connections.forEach(client => {
      const role = this.connectionManager.getRole(client);
      const clientSessionId = this.connectionManager.getSessionId(client);
      
      if (role === 'teacher' && clientSessionId === sessionId) {
        try {
          client.send(JSON.stringify(message));
          logger.info(`Broadcasted student count update: ${studentCount} to teacher in session ${sessionId}`);
        } catch (error) {
          logger.error('Failed to broadcast student count to teacher:', { error, sessionId });
        }
      }
    });
  }
}