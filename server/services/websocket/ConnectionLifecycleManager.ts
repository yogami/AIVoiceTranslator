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
  private webSocketServer?: any; // WebSocketServer instance for accessing SessionCleanupService

  constructor(
    connectionManager: ConnectionManager,
    classroomSessionManager: ClassroomSessionManager,
    storageSessionManager: StorageSessionManager,
    connectionHealthManager: ConnectionHealthManager,
    messageDispatcher: MessageDispatcher,
    webSocketServer?: any
  ) {
    this.connectionManager = connectionManager;
    this.classroomSessionManager = classroomSessionManager;
    this.storageSessionManager = storageSessionManager;
    this.connectionHealthManager = connectionHealthManager;
    this.messageDispatcher = messageDispatcher;
    this.responseService = new WebSocketResponseService();
    this.webSocketServer = webSocketServer;
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
    this.connectionManager.addConnection(ws, sessionId, classroomCode || undefined);
    
    // Send immediate connection confirmation directly
    try {
      logger.info('Sending connection confirmation:', { sessionId, classroomCode });
      this.responseService.sendConnectionConfirmation(ws, sessionId, classroomCode || undefined);
      logger.info('Connection confirmation sent successfully');
    } catch (error) {
      logger.error('Failed to send connection confirmation:', { sessionId, error });
    }
    
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
    // Note: Message handling is done by WebSocketServer to avoid duplication
    // Only set up close and error handlers here
    
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
   * Send connection confirmation to client
   */
  public sendConnectionConfirmation(ws: WebSocketClient, classroomCode?: string | null, sessionId?: string): void {
    try {
      const finalSessionId = sessionId || this.connectionManager.getSessionId(ws);
      this.responseService.sendConnectionConfirmation(ws, finalSessionId || 'unknown', classroomCode || undefined);
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
   * Handle WebSocket connection close
   */
  public async handleConnectionClose(ws: WebSocketClient): Promise<void> {
    const sessionId = this.connectionManager.getSessionId(ws);
    const role = this.connectionManager.getRole(ws);
    
    logger.info('WebSocket connection closed', { sessionId, role });
    
    // Remove connection from tracking
    this.connectionManager.removeConnection(ws);
    
    // If this was a student connection, check if any students remain and update count
    if (sessionId && role === 'student') {
      // First, decrement the studentsCount if this student was counted
      if (this.connectionManager.isStudentCounted(ws)) {
        try {
          const session = await this.webSocketServer?.storage?.getActiveSession(sessionId);
          if (session && session.studentsCount > 0) {
            await this.webSocketServer.storageSessionManager.updateSession(sessionId, {
              studentsCount: session.studentsCount - 1
            });
            logger.info(`Decremented studentsCount for session ${sessionId} to ${session.studentsCount - 1}`);
          }
        } catch (error: any) {
          logger.error('Error updating studentsCount on disconnect:', error);
        }
      }
      
      const remainingStudents = this.countActiveStudentsInSession(sessionId);
      const remainingTeachers = this.countActiveTeachersInSession(sessionId);
      
      logger.info(`Student disconnected from session ${sessionId}. Remaining: ${remainingStudents} students, ${remainingTeachers} teachers`);
      
      if (remainingStudents === 0) {
        if (remainingTeachers > 0) {
          // Students left but teacher still there - start grace period
          try {
            const cleanupService = this.webSocketServer?.getSessionCleanupService();
            if (cleanupService) {
              await cleanupService.markAllStudentsLeft(sessionId);
            }
          } catch (error: any) {
            logger.error('Error marking students left:', error);
          }
        } else {
          // No one left - end session immediately
          try {
            const cleanupService = this.webSocketServer?.getSessionCleanupService();
            if (cleanupService) {
              await cleanupService.endSession(sessionId, 'All users disconnected');
            }
          } catch (error: any) {
            logger.error('Error ending session:', error);
          }
        }
      }
    } else if (sessionId && role === 'teacher') {
      // Teacher disconnected - check if any students remain
      const remainingStudents = this.countActiveStudentsInSession(sessionId);
      const remainingTeachers = this.countActiveTeachersInSession(sessionId);
      
      logger.info(`Teacher disconnected from session ${sessionId}. Remaining: ${remainingStudents} students, ${remainingTeachers} teachers`);
      
      if (remainingTeachers === 0 && remainingStudents === 0) {
        // No one left - end session immediately
        try {
          const cleanupService = this.webSocketServer?.getSessionCleanupService();
          if (cleanupService) {
            await cleanupService.endSession(sessionId, 'All users disconnected');
          }
        } catch (error: any) {
          logger.error('Error ending session:', error);
        }
      }
      // If students remain but no teachers, let them stay connected for a while
      // The cleanup service will handle this scenario
    }
  }

  /**
   * Count active students in a session
   */
  private countActiveStudentsInSession(sessionId: string): number {
    let count = 0;
    for (const conn of this.connectionManager.getConnections()) {
      if (this.connectionManager.getSessionId(conn) === sessionId && 
          this.connectionManager.getRole(conn) === 'student') {
        count++;
      }
    }
    return count;
  }

  /**
   * Count active teachers in a session
   */
  private countActiveTeachersInSession(sessionId: string): number {
    let count = 0;
    for (const conn of this.connectionManager.getConnections()) {
      if (this.connectionManager.getSessionId(conn) === sessionId && 
          this.connectionManager.getRole(conn) === 'teacher') {
        count++;
      }
    }
    return count;
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