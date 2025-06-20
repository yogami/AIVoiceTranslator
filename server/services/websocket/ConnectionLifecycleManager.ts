/**
 * Connection Lifecycle Manager
 * 
 * Manages WebSocket connection setup, teardown, and lifecycle events.
 * Handles the initialization and cleanup of WebSocket connections.
 */
import logger from '../../logger';
import { config } from '../../config';
import { URL } from 'url';
import { WebSocketClient } from './ConnectionManager';
import { ConnectionManager } from './ConnectionManager';
import { ClassroomSessionManager } from './ClassroomSessionManager';
import { StorageSessionManager } from './StorageSessionManager';
import { ConnectionHealthManager } from './ConnectionHealthManager';
import { MessageDispatcher } from './MessageHandler';
import { WebSocketResponseService } from './WebSocketResponseService';
import type { ConnectionMessageToClient } from '../WebSocketTypes';

export class ConnectionLifecycleManager {
  private sessionCounter: number = 0;
  private connectionManager: ConnectionManager;
  private classroomSessionManager: ClassroomSessionManager;
  private storageSessionManager: StorageSessionManager;
  private connectionHealthManager: ConnectionHealthManager;
  private messageDispatcher: MessageDispatcher;
  private responseService: WebSocketResponseService;

  constructor(
    connectionManager: ConnectionManager,
    classroomSessionManager: ClassroomSessionManager,
    storageSessionManager: StorageSessionManager,
    connectionHealthManager: ConnectionHealthManager,
    messageDispatcher: MessageDispatcher
  ) {
    this.connectionManager = connectionManager;
    this.classroomSessionManager = classroomSessionManager;
    this.storageSessionManager = storageSessionManager;
    this.connectionHealthManager = connectionHealthManager;
    this.messageDispatcher = messageDispatcher;
    this.responseService = new WebSocketResponseService();
  }

  /**
   * Handle new WebSocket connection
   */
  public async handleConnection(ws: WebSocketClient, request?: any): Promise<void> {
    logger.info('New WebSocket connection established');
    
    // Initialize connection health tracking
    this.connectionHealthManager.initializeConnection(ws);
    
    // Parse URL for classroom code and generate session ID
    const { sessionId, classroomCode } = this.parseConnectionRequest(request);
    
    // Validate classroom code if provided
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
    
    // Create session in storage for metrics tracking
    try {
      await this.storageSessionManager.createSession(sessionId);
    } catch (error) {
      logger.error('Failed to create session in storage:', { error });
      // Continue without metrics - don't break core functionality
    }
    
    // Send immediate connection confirmation
    this.sendConnectionConfirmation(ws, classroomCode);
    
    // Set up event handlers
    this.setupConnectionEventHandlers(ws);
  }

  /**
   * Parse connection request to extract session ID and classroom code
   */
  public parseConnectionRequest(request?: any): { sessionId: string; classroomCode: string | null } {
    let sessionId = this.generateSessionId();
    let classroomCode: string | null = null;
    
    if (request?.url) {
      // Construct the base URL using the configured host and port
      const baseUrl = `http://${config.server.host}:${config.server.port}`;
      const url = new URL(request.url, baseUrl);
      classroomCode = url.searchParams.get('class') || url.searchParams.get('code');
      
      if (classroomCode) {
        // Use classroom session ID if available
        const session = this.classroomSessionManager.getSessionByCode(classroomCode);
        if (session) {
          sessionId = session.sessionId;
          logger.info(`Client joining classroom ${classroomCode} with session ${sessionId}`);
        }
      }
    }
    
    return { sessionId, classroomCode };
  }

  /**
   * Set up event handlers for a WebSocket connection
   */
  private setupConnectionEventHandlers(ws: WebSocketClient): void {
    // Set up message handler
    ws.on('message', (data: any) => {
      this.handleMessage(ws, data.toString());
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
   * Handle incoming WebSocket message
   */
  private async handleMessage(ws: WebSocketClient, data: string): Promise<void> {
    // Delegate to message dispatcher
    await this.messageDispatcher.dispatch(ws, data);
  }

  /**
   * Send connection confirmation to client
   */
  public sendConnectionConfirmation(ws: WebSocketClient, classroomCode?: string | null): void {
    try {
      const sessionId = this.connectionManager.getSessionId(ws);
      this.responseService.sendConnectionConfirmation(ws, sessionId || 'unknown', classroomCode || undefined);
    } catch (error) {
      logger.error('Error sending connection confirmation:', { error });
    }
  }

  /**
   * Handle WebSocket close event
   */
  private handleClose(ws: WebSocketClient): void {
    const sessionId = this.connectionManager.getSessionId(ws);
    logger.info('WebSocket disconnected, sessionId:', { sessionId });
    
    // Check if there are other connections with the same sessionId BEFORE removing this one
    const hasOtherConnections = this.hasOtherConnectionsWithSessionId(sessionId);
    
    // Remove from tracking using ConnectionManager
    this.connectionManager.removeConnection(ws);
    
    // End session in storage if no more connections with this sessionId
    if (sessionId && !hasOtherConnections) {
      this.storageSessionManager.endSession(sessionId).catch(error => {
        logger.error('Failed to end session in storage:', { error });
      });
    }
  }

  /**
   * Handle connection close event (public interface)
   */
  public handleConnectionClose(ws: WebSocketClient): void {
    this.handleClose(ws);
  }

  /**
   * Check if there are other connections with the same session ID
   */
  private hasOtherConnectionsWithSessionId(sessionId: string | undefined): boolean {
    if (!sessionId) return false;
    
    // Count how many connections have the same sessionId
    let connectionsWithSameSession = 0;
    for (const connection of this.connectionManager.getConnections()) {
      if (this.connectionManager.getSessionId(connection) === sessionId) {
        connectionsWithSameSession++;
      }
    }
    return connectionsWithSameSession > 1; // More than just the one being removed
  }

  /**
   * Generate a unique session ID
   */
  private generateSessionId(): string {
    this.sessionCounter++;
    return `session-${this.sessionCounter}-${Date.now()}`;
  }

  /**
   * Get lifecycle metrics
   */
  public getLifecycleMetrics(): {
    sessionsCreated: number;
    currentSessionId: number;
  } {
    return {
      sessionsCreated: this.sessionCounter,
      currentSessionId: this.sessionCounter
    };
  }
}