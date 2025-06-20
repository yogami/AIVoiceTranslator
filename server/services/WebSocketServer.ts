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
  private connectionManager: ConnectionManager; // Use ConnectionManager for connection tracking
  private sessionService: SessionService; // Injected SessionService for session management
  private translationOrchestrator: TranslationOrchestrator; // Injected TranslationOrchestrator for translation and TTS
  private classroomSessionManager: ClassroomSessionManager; // Handles classroom session management
  private storageSessionManager: StorageSessionManager; // Handles storage operations
  private connectionHealthManager: ConnectionHealthManager; // Handles connection health monitoring
  private connectionLifecycleManager: ConnectionLifecycleManager; // Handles connection lifecycle
  
  // Message handling infrastructure
  private messageHandlerRegistry: MessageHandlerRegistry;
  private messageDispatcher: MessageDispatcher;
  
  // Legacy - will be removed once fully migrated to SessionService
  private classroomSessions: Map<string, ClassroomSession> = new Map();
  private classroomCleanupInterval: NodeJS.Timeout | null = null;

  // Stats
  private heartbeatInterval: NodeJS.Timeout | null = null;

  constructor(server: http.Server, storage: IStorage) { 
    this.wss = new WSServer({ server });
    this.storage = storage;
    this.connectionManager = new ConnectionManager(); // Initialize ConnectionManager
    this.sessionService = new SessionService(storage); // Initialize SessionService
    this.translationOrchestrator = new TranslationOrchestrator(storage); // Initialize TranslationOrchestrator
    this.classroomSessionManager = new ClassroomSessionManager(); // Initialize ClassroomSessionManager
    this.storageSessionManager = new StorageSessionManager(storage); // Initialize StorageSessionManager
    this.connectionHealthManager = new ConnectionHealthManager(this.wss); // Initialize ConnectionHealthManager
    
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
      classroomSessions: this.classroomSessions, // Legacy - for backwards compatibility
      webSocketServer: this
    };
    this.messageDispatcher = new MessageDispatcher(this.messageHandlerRegistry, context);
    
    // Initialize ConnectionLifecycleManager (depends on other managers and messageDispatcher)
    this.connectionLifecycleManager = new ConnectionLifecycleManager(
      this.connectionManager,
      this.classroomSessionManager,
      this.storageSessionManager,
      this.connectionHealthManager,
      this.messageDispatcher
    );
   
    
    // Set up event handlers
    this.setupEventHandlers();
    
    // Set up classroom session cleanup
    this.setupClassroomCleanup();
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
   * Get the number of active WebSocket connections (alias for getActiveSessionCount).
   * Implements IActiveSessionProvider.
   * @returns The number of active connections.
   */
  public getActiveSessionsCount(): number { // Renamed from getActiveSessionCount to getActiveSessionsCount
    return this.connectionManager.getConnectionCount();
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
    this.wss.on('connection', async (ws: WebSocket, request) => {
      // Cast WebSocket to our custom WebSocketClient type and delegate to ConnectionLifecycleManager
      await this.handleConnection(ws as unknown as WebSocketClient, request);
    });
    
    // Note: Heartbeat is now handled by ConnectionHealthManager
  }
  
  /**
   * Handle new WebSocket connection
   */
  private async handleConnection(ws: WebSocketClient, request?: any): Promise<void> {
    logger.info('New WebSocket connection established');
    
    // Initialize connection health tracking
    this.connectionHealthManager.initializeConnection(ws);
    
    // Parse URL for classroom code and generate session ID - delegate to ConnectionLifecycleManager
    const { sessionId, classroomCode } = await this.connectionLifecycleManager.parseConnectionRequest(request);
    
    // Validate classroom code if provided - delegate to ClassroomSessionManager
    if (classroomCode && !this.classroomSessionManager.isValidClassroomCode(classroomCode)) {
      logger.warn(`Invalid classroom code attempted: ${classroomCode}`);
      ws.send(JSON.stringify({
        type: 'error',
        message: 'Classroom session expired or invalid. Please ask teacher for new link.',
        code: 'INVALID_CLASSROOM'
      }));
      ws.close(1008, 'Invalid classroom session');
      return;
    }
    
    // Store connection data
    this.connectionManager.addConnection(ws, sessionId);
    
    // Create session in storage using StorageSessionManager
    this.storageSessionManager.createSession(sessionId).catch(error => {
      logger.error('Failed to create session in storage:', { error });
      // Continue without metrics - don't break core functionality
    });
    
    // Send immediate connection confirmation - delegate to ConnectionLifecycleManager
    this.connectionLifecycleManager.sendConnectionConfirmation(ws, classroomCode);

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
    // Use the message dispatcher to handle all messages
    await this.messageDispatcher.dispatch(ws, data);
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
  /**
   * Get active session metrics for diagnostics
   */
  getActiveSessionMetrics() {
    const activeSessions = new Set<string>();
    let studentsConnected = 0;
    let teachersConnected = 0;
    const currentLanguages = new Set<string>();

    const connections = this.connectionManager.getConnections();

    for (const connection of connections) {
      const sessionId = this.connectionManager.getSessionId(connection);
      const role = this.connectionManager.getRole(connection);
      const language = this.connectionManager.getLanguage(connection);
      
      if (sessionId) {
        // Find classroom code for this session using ClassroomSessionManager first
        let classroomCode = this.classroomSessionManager.getClassroomCodeBySessionId(sessionId);
        
        // Fall back to legacy classroomSessions Map for backward compatibility
        if (!classroomCode) {
          for (const [code, session] of this.classroomSessions.entries()) {
            if (session.sessionId === sessionId) {
              classroomCode = code;
              break;
            }
          }
        }
        
        if (classroomCode) {
          activeSessions.add(classroomCode);
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

    // 2. Shutdown SessionService
    this.sessionService.shutdown();
    logger.info('[WebSocketServer] SessionService shutdown completed.');

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
    this.classroomSessions.clear(); // Legacy - keeping for backward compatibility
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
}