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
import { audioTranscriptionService } from './transcription/AudioTranscriptionService'; // Corrected import path
import { config } from '../config'; // Removed AppConfig, already have config instance
import { URL } from 'url';

import { IActiveSessionProvider } from './IActiveSessionProvider'; // Added import
import { ConnectionManager, type WebSocketClient } from './websocket/ConnectionManager'; // Added import
import { SessionService, type ClassroomSession } from './websocket/SessionService'; // Added SessionService import
import { TranslationOrchestrator } from './websocket/TranslationOrchestrator'; // Added TranslationOrchestrator import
import { ClassroomSessionManager } from './websocket/ClassroomSessionManager'; // Added ClassroomSessionManager import
import { StorageSessionManager } from './websocket/StorageSessionManager'; // Added StorageSessionManager import
import { ConnectionHealthManager } from './websocket/ConnectionHealthManager'; // Added ConnectionHealthManager import
import { ConnectionLifecycleManager } from './websocket/ConnectionLifecycleManager'; // Added ConnectionLifecycleManager import
import { ConnectionValidationService } from './websocket/ConnectionValidationService'; // Added ConnectionValidationService import
import { SessionMetricsService } from './websocket/SessionMetricsService'; // Added SessionMetricsService import
import { WebSocketResponseService } from './websocket/WebSocketResponseService'; // Added WebSocketResponseService import
import { SessionLifecycleService } from './SessionLifecycleService'; // Added SessionLifecycleService import
import { SessionCountCacheService } from './SessionCountCacheService'; // Added SessionCountCacheService import
import { 
  MessageHandlerRegistry, 
  MessageDispatcher, 
  MessageHandlerContext 
} from './websocket/MessageHandler'; // Added message handler imports
import { RegisterMessageHandler } from './websocket/RegisterMessageHandler'; // Added register handler
import { PingMessageHandler } from './websocket/PingMessageHandler'; // Added ping handler
import { SettingsMessageHandler } from './websocket/SettingsMessageHandler'; // Added settings handler
import { TranscriptionMessageHandler } from './websocket/TranscriptionMessageHandler'; // Added transcription handler
import { TTSRequestMessageHandler } from './websocket/TTSRequestMessageHandler'; // Added TTS request handler
import { AudioMessageHandler } from './websocket/AudioMessageHandler'; // Added audio handler
import { PongMessageHandler } from './websocket/PongMessageHandler'; // Added pong handler
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
  SettingsResponseToClient,
  PongMessageToClient,
  ErrorMessageToClient,
  StudentJoinedMessageToClient // Added import
} from './WebSocketTypes';
import { type InsertSession } from '../../shared/schema'; // Added import
import { IStorage } from '../storage.interface';

// Custom WebSocketClient type for our server
// Moved to ConnectionManager.ts and re-exported

export class WebSocketServer implements IActiveSessionProvider { // Implement IActiveSessionProvider
  private wss: WSServer;
  private storage: IStorage;
  
  // Add static registry to track all instances for cleanup
  private static instances: Set<WebSocketServer> = new Set();
  private isShutdown = false;
  
  private connectionManager: ConnectionManager; // Use ConnectionManager for connection tracking
  private sessionService: SessionService; // Injected SessionService for session management
  private translationOrchestrator: TranslationOrchestrator; // Injected TranslationOrchestrator for translation and TTS
  private classroomSessionManager: ClassroomSessionManager; // Handles classroom session management
  private storageSessionManager: StorageSessionManager; // Handles storage operations
  private connectionHealthManager: ConnectionHealthManager; // Handles connection health monitoring
  private connectionLifecycleManager: ConnectionLifecycleManager; // Handles connection lifecycle
  private connectionValidationService: ConnectionValidationService; // Handles connection validation
  private sessionMetricsService: SessionMetricsService; // Handles session metrics calculation
  private webSocketResponseService: WebSocketResponseService; // Handles WebSocket response formatting
  private sessionLifecycleService: SessionLifecycleService; // Handles session lifecycle management
  private sessionCleanupService: any; // Dynamically imported SessionCleanupService
  private sessionCountCacheService: SessionCountCacheService; // Handles session count caching
  
  // Message handling infrastructure
  private messageHandlerRegistry: MessageHandlerRegistry;
  private messageDispatcher: MessageDispatcher;
  
  // Lifecycle management
  private lifecycleCleanupInterval: NodeJS.Timeout | null = null;

  // Stats
  private heartbeatInterval: NodeJS.Timeout | null = null;

  constructor(server: http.Server, storage: IStorage) { 
    // Register this instance for cleanup tracking
    WebSocketServer.instances.add(this);
    
    this.wss = new WSServer({ server });
    this.storage = storage;
    this.connectionManager = new ConnectionManager(); // Initialize ConnectionManager
    this.sessionService = new SessionService(storage); // Initialize SessionService
    this.translationOrchestrator = new TranslationOrchestrator(storage); // Initialize TranslationOrchestrator
    this.classroomSessionManager = new ClassroomSessionManager(); // Initialize ClassroomSessionManager
    this.storageSessionManager = new StorageSessionManager(storage); // Initialize StorageSessionManager
    this.storageSessionManager.setClassroomSessionManager(this.classroomSessionManager); // Inject classroom session manager
    this.connectionHealthManager = new ConnectionHealthManager(this.wss); // Initialize ConnectionHealthManager
    this.connectionValidationService = new ConnectionValidationService(this.classroomSessionManager); // Initialize ConnectionValidationService
    this.sessionMetricsService = new SessionMetricsService(this.connectionManager, this.classroomSessionManager); // Initialize SessionMetricsService
    this.webSocketResponseService = new WebSocketResponseService(); // Initialize WebSocketResponseService
    this.sessionLifecycleService = new SessionLifecycleService(storage); // Initialize SessionLifecycleService
    this.sessionCountCacheService = new SessionCountCacheService(storage); // Initialize SessionCountCacheService
    
    // Initialize message handling infrastructure
    this.messageHandlerRegistry = new MessageHandlerRegistry();
    this.setupMessageHandlers();
    
    // Create message dispatcher with context
    const context: MessageHandlerContext = {
      ws: null as any, // Will be set by the dispatcher for each message
      connectionManager: this.connectionManager,
      storage: this.storage,
      sessionService: this.sessionService, // Inject SessionService
      translationService: this.translationOrchestrator, // Inject TranslationOrchestrator
      sessionLifecycleService: this.sessionLifecycleService, // Inject SessionLifecycleService
      webSocketServer: this
    };
    this.messageDispatcher = new MessageDispatcher(this.messageHandlerRegistry, context);
     // Initialize ConnectionLifecycleManager (depends on other managers and messageDispatcher)
    this.connectionLifecycleManager = new ConnectionLifecycleManager(
      this.connectionManager,
      this.classroomSessionManager,
      this.storageSessionManager,
      this.connectionHealthManager,
      this.messageDispatcher,
      this
    );
   
    // Set up event handlers
    this.setupEventHandlers();
    
    // Start session lifecycle management tasks
    this.startSessionLifecycleManagement();
    
    // Initialize and start SessionCleanupService (async, but don't wait for it)
    this.initializeSessionCleanupService().catch(error => {
      logger.error('Failed to initialize SessionCleanupService during construction:', { error });
    });
    
    // Start caching database session count for accurate metrics
    this.sessionCountCacheService.start();
    
    // Note: Classroom session cleanup is now handled by ClassroomSessionManager
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
    
    // Use the ConnectionLifecycleManager to handle the full connection lifecycle
    // This includes session creation, validation, and setup
    this.connectionLifecycleManager.handleConnection(ws, request).catch(error => {
      logger.error('Error in connection lifecycle handling:', { error });
    });

    // Set up message handler
    ws.on('message', (data: any) => {
      this.handleMessage(ws, data.toString());
    });
    
    // Set up close handler - delegate to ConnectionLifecycleManager  
    ws.on('close', () => {
      this.connectionLifecycleManager.handleConnectionClose(ws);
    });
    
    // Set up error handler
    ws.on('error', (error) => {
      logger.error('WebSocket error:', { error });
    });
  }

  /**
   * Handle incoming WebSocket message
   */
  async handleMessage(ws: WebSocketClient, data: string): Promise<void> {
    // Debug: Log message types to identify source of continuous messages
    let messageType = 'unknown';
    try {
      const messageData = JSON.parse(data);
      messageType = messageData.type;
      if (messageType !== 'ping' && messageType !== 'pong') {
        logger.debug('Handling message', { type: messageType, sessionId: this.connectionManager.getSessionId(ws) });
      }
    } catch (error) {
      // Ignore JSON parse errors for debugging
    }
    
    // Use the message dispatcher to handle all messages first
    try {
      await this.messageDispatcher.dispatch(ws, data);
    } catch (error) {
      logger.error('Message dispatch error:', { error, data });
      return; // Don't update session activity if message dispatch failed
    }
    
    // Only update session activity AFTER message processing for meaningful messages
    // that should happen after registration (not register itself)
    const activityUpdateMessages = ['transcription', 'audio', 'settings'];
    if (activityUpdateMessages.includes(messageType)) {
      await this.updateSessionActivity(ws);
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
  public close(): void {
    // Clear heartbeat interval
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    
    // Clear lifecycle cleanup interval
    if (this.lifecycleCleanupInterval) {
      clearInterval(this.lifecycleCleanupInterval);
      this.lifecycleCleanupInterval = null;
    }
    
    this.wss.close();
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

    // 2. Shutdown SessionService
    this.sessionService.shutdown();
    logger.info('[WebSocketServer] SessionService shutdown completed.');

    // 2.1. Stop SessionCleanupService
    if (this.sessionCleanupService) {
      try {
        this.sessionCleanupService.stop();
        logger.info('[WebSocketServer] SessionCleanupService stopped.');
      } catch (error) {
        logger.error('[WebSocketServer] Error stopping SessionCleanupService:', { error });
      }
    }

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

  // Backward compatibility properties for unit tests
  // These delegate to the ConnectionManager to maintain the same interface
  private _connectionsSet: Set<WebSocketClient> | null = null;

  public get connections(): Set<WebSocketClient> {
    if (!this._connectionsSet) {
      const manager = this.connectionManager;
      const realSet = manager.getConnections();
      
      // Create a proxy that intercepts Set operations
      this._connectionsSet = new Proxy(realSet, {
        get(target, prop) {
          if (prop === 'add') {
            return (ws: WebSocketClient) => {
              const sessionId = ws.sessionId || 'temp-session-' + Date.now();
              manager.addConnection(ws, sessionId);
              return target;
            };
          }
          if (prop === 'delete') {
            return (ws: WebSocketClient) => {
              manager.removeConnection(ws);
              return true;
            };
          }
          return target[prop as keyof Set<WebSocketClient>];
        }
      });
    }
    return this._connectionsSet;
  }

  public set connections(value: Set<WebSocketClient>) {
    // Clear existing connections and add new ones
    // But preserve any sessionIds that were already set for these connections
    const existingSessionIds = new Map<WebSocketClient, string>();
    for (const connection of value) {
      const existingSessionId = this.connectionManager.getSessionId(connection);
      if (existingSessionId) {
        existingSessionIds.set(connection, existingSessionId);
      }
    }
    
    this.connectionManager.clearAll();
    for (const connection of value) {
      // Use existing sessionId if available, otherwise use a temporary one
      const sessionId = existingSessionIds.get(connection) || connection.sessionId || `temp-${Date.now()}-${Math.random()}`;
      this.connectionManager.addConnection(connection, sessionId);
    }
    this._connectionsSet = null; // Reset proxy
  }

  public get roles(): Map<WebSocketClient, string> {
    const manager = this.connectionManager;
    const rolesMap = new Map<WebSocketClient, string>();
    
    // Populate with current data
    for (const connection of manager.getConnections()) {
      const role = manager.getRole(connection);
      if (role) {
        rolesMap.set(connection, role);
      }
    }
    
    // Return a proxy that intercepts Map operations
    return new Proxy(rolesMap, {
      get(target, prop) {
        if (prop === 'set') {
          return (ws: WebSocketClient, role: string) => {
            manager.setRole(ws, role);
            return target.set(ws, role); // Also update the map for consistency
          };
        }
        if (prop === 'get') {
          return (ws: WebSocketClient) => manager.getRole(ws);
        }
        return target[prop as keyof Map<WebSocketClient, string>];
      }
    });
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
    const manager = this.connectionManager;
    const sessionIdsMap = new Map<WebSocketClient, string>();
    
    // Populate with current data
    for (const connection of manager.getConnections()) {
      const sessionId = manager.getSessionId(connection);
      if (sessionId) {
        sessionIdsMap.set(connection, sessionId);
      }
    }
    
    // Return a proxy that intercepts Map operations
    return new Proxy(sessionIdsMap, {
      get(target, prop) {
        if (prop === 'set') {
          return (ws: WebSocketClient, sessionId: string) => {
            // Use the new method that doesn't clear other metadata
            manager.updateSessionId(ws, sessionId);
            return target.set(ws, sessionId); // Also update the map for consistency
          };
        }
        if (prop === 'delete') {
          return (ws: WebSocketClient) => {
            // Only remove the sessionId, not the entire connection
            manager.removeSessionId(ws);
            return target.delete(ws);
          };
        }
        if (prop === 'get') {
          return (ws: WebSocketClient) => manager.getSessionId(ws);
        }
        return target[prop as keyof Map<WebSocketClient, string>];
      }
    });
  }

  public set sessionIds(value: Map<WebSocketClient, string>) {
    for (const [connection, sessionId] of value) {
      // Use the new method that doesn't clear other metadata
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
    
    // TODO: Add other message handlers as we extract them:
    // - AudioMessageHandler  
    // - TTSRequestMessageHandler
  }

  /**
   * Start session lifecycle management tasks
   */
  private startSessionLifecycleManagement(): void {
    // Process inactive sessions every 2 minutes  
    this.lifecycleCleanupInterval = setInterval(async () => {
      try {
        // Skip processing if server is shutting down
        if (this.isShutdown) {
          return;
        }
        
        // Process inactive sessions (end sessions that haven't had activity)
        const inactiveResult = await this.sessionLifecycleService.processInactiveSessions();
        if (inactiveResult.endedCount > 0 || inactiveResult.classifiedCount > 0) {
          logger.info('Session lifecycle: processed inactive sessions', inactiveResult);
        }

        // Clean up and classify dead sessions
        const cleanupResult = await this.sessionLifecycleService.cleanupDeadSessions();
        if (cleanupResult.classified > 0) {
          logger.info('Session lifecycle: classified sessions', cleanupResult);
        }
      } catch (error) {
        logger.error('Session lifecycle management error:', { error });
      }
    }, 2 * 60 * 1000); // Every 2 minutes

    logger.info('Session lifecycle management started');
  }

  /**
   * Initialize and start the SessionCleanupService
   */
  private async initializeSessionCleanupService(): Promise<void> {
    try {
      const { SessionCleanupService } = await import('./SessionCleanupService');
      this.sessionCleanupService = new SessionCleanupService();
      this.sessionCleanupService.start();
      logger.info('SessionCleanupService started');
    } catch (error) {
      logger.error('Failed to initialize SessionCleanupService:', { error });
    }
  }

  /**
   * Get the SessionCleanupService instance
   */
  public getSessionCleanupService(): any {
    return this.sessionCleanupService;
  }

  /**
   * Update storage instance - used for test isolation
   */
  public updateStorage(newStorage: IStorage): void {
    this.storage = newStorage;
    this.sessionService = new SessionService(newStorage);
    this.translationOrchestrator = new TranslationOrchestrator(newStorage);
    this.storageSessionManager = new StorageSessionManager(newStorage);
    this.storageSessionManager.setClassroomSessionManager(this.classroomSessionManager); // Inject classroom session manager
    this.sessionLifecycleService = new SessionLifecycleService(newStorage);
    this.sessionCountCacheService.updateStorage(newStorage);
    
    // Update message dispatcher context
    const context: MessageHandlerContext = {
      ws: null as any,
      connectionManager: this.connectionManager,
      storage: newStorage,
      sessionService: this.sessionService,
      translationService: this.translationOrchestrator,
      sessionLifecycleService: this.sessionLifecycleService,
      webSocketServer: this
    };
    this.messageDispatcher = new MessageDispatcher(this.messageHandlerRegistry, context);
  }

  /**
   * Update session activity for the current connection's session
   */
  public async updateSessionActivity(ws: WebSocketClient): Promise<void> {
    const sessionId = this.connectionManager.getSessionId(ws);
    if (sessionId) {
      // Aggressive throttling to prevent database spam
      // Only update if last update was more than 30 seconds ago
      const now = Date.now();
      const lastUpdate = (ws as any).lastActivityUpdate || 0;
      if (now - lastUpdate > 30000) { // 30 seconds throttle (was 5 seconds)
        (ws as any).lastActivityUpdate = now;
        await this.sessionLifecycleService.updateSessionActivity(sessionId);
      }
    }
  }

  // Helper getter for tests to access connectionHealthManager
  public get _connectionHealthManager() {
    return this.connectionHealthManager;
  }
}