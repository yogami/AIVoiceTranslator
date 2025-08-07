/**
 * Real-Time Communication Service
 * 
 * This service orchestrates real-time communication in the application.
 * It's protocol-agnostic and can work with WebSocket, WebRTC, or any future protocol.
 * 
 * SOLID Principles:
 * - Single Responsibility: Orchestrates real-time communication workflow
 * - Open/Closed: Protocol switching without code changes
 * - Liskov Substitution: Any protocol implementation works seamlessly
 * - Interface Segregation: Uses focused communication protocol interface
 * - Dependency Inversion: Depends on abstractions, not concrete protocols
 */

import logger from '../../logger';
import { IStorage } from '../../storage.interface';
import { 
  IConnection, 
  ICommunicationServer, 
  ICommunicationProtocol 
} from './ICommunicationProtocol';
import { IActiveSessionProvider } from '../session/IActiveSessionProvider';

export interface IRealTimeCommunicationService extends IActiveSessionProvider {
  // Service lifecycle
  start(): Promise<void>;
  stop(): Promise<void>;
  
  // Connection management
  getConnections(): IConnection[];
  getConnection(id: string): IConnection | undefined;
  
  // Role-based operations
  getTeacherConnections(): IConnection[];
  getStudentConnections(): IConnection[];
  
  // Session-based operations
  getConnectionsBySession(sessionId: string): IConnection[];
  
  // Broadcasting
  broadcast(message: any): Promise<void>;
  broadcastToRole(role: string, message: any): Promise<void>;
  broadcastToSession(sessionId: string, message: any): Promise<void>;
  
  // Protocol switching
  switchProtocol(protocol: ICommunicationProtocol): Promise<void>;
  getCurrentProtocol(): string;
  
  // Connection events
  onConnection(handler: (connection: IConnection) => void): void;
  onDisconnection(handler: (connection: IConnection) => void): void;
  onMessage(handler: (connection: IConnection, message: any) => void): void;
}

export class RealTimeCommunicationService implements IRealTimeCommunicationService {
  private communicationServer: ICommunicationServer | null = null;
  private currentProtocol: ICommunicationProtocol | null = null;
  private connectionHandlers: ((connection: IConnection) => void)[] = [];
  private disconnectionHandlers: ((connection: IConnection) => void)[] = [];
  private messageHandlers: ((connection: IConnection, message: any) => void)[] = [];
  private isStarted = false;

  constructor(
    private protocol: ICommunicationProtocol,
    private storage: IStorage,
    private httpServer?: any,
    private options?: any
  ) {
    this.currentProtocol = protocol;
  }

  async start(): Promise<void> {
    if (this.isStarted) {
      logger.warn('RealTimeCommunicationService is already started');
      return;
    }

    if (!this.currentProtocol) {
      throw new Error('No communication protocol configured');
    }

    this.communicationServer = this.currentProtocol.createServer(this.httpServer, this.options);
    
    // Set up event handlers
    this.communicationServer.onConnection((connection) => {
      this.handleConnection(connection);
    });
    
    this.communicationServer.onDisconnection((connection) => {
      this.handleDisconnection(connection);
    });

    await this.communicationServer.start();
    this.isStarted = true;
    
    logger.info(`RealTimeCommunicationService started with protocol: ${this.currentProtocol.name}`);
  }

  async stop(): Promise<void> {
    if (!this.isStarted) {
      logger.warn('RealTimeCommunicationService is not started');
      return;
    }

    if (this.communicationServer) {
      await this.communicationServer.stop();
      this.communicationServer = null;
    }
    
    this.isStarted = false;
    logger.info('RealTimeCommunicationService stopped');
  }

  async switchProtocol(protocol: ICommunicationProtocol): Promise<void> {
    const wasStarted = this.isStarted;
    
    if (wasStarted) {
      await this.stop();
    }
    
    this.currentProtocol = protocol;
    
    if (wasStarted) {
      await this.start();
    }
    
    logger.info(`Switched to protocol: ${protocol.name}`);
  }

  getCurrentProtocol(): string {
    return this.currentProtocol?.name || 'none';
  }

  getConnections(): IConnection[] {
    return this.communicationServer?.getConnections() || [];
  }

  getConnection(id: string): IConnection | undefined {
    return this.communicationServer?.getConnection(id);
  }

  getTeacherConnections(): IConnection[] {
    return this.communicationServer?.getTeacherConnections() || [];
  }

  getStudentConnections(): IConnection[] {
    return this.communicationServer?.getStudentConnections() || [];
  }

  getConnectionsBySession(sessionId: string): IConnection[] {
    return this.communicationServer?.getConnectionsBySession(sessionId) || [];
  }

  async broadcast(message: any): Promise<void> {
    if (!this.communicationServer) {
      throw new Error('Communication server not started');
    }
    
    const messageStr = typeof message === 'string' ? message : JSON.stringify(message);
    await this.communicationServer.broadcast(messageStr);
  }

  async broadcastToRole(role: string, message: any): Promise<void> {
    if (!this.communicationServer) {
      throw new Error('Communication server not started');
    }
    
    const messageStr = typeof message === 'string' ? message : JSON.stringify(message);
    await this.communicationServer.broadcastToRole(role, messageStr);
  }

  async broadcastToSession(sessionId: string, message: any): Promise<void> {
    if (!this.communicationServer) {
      throw new Error('Communication server not started');
    }
    
    const messageStr = typeof message === 'string' ? message : JSON.stringify(message);
    await this.communicationServer.broadcastToSession(sessionId, messageStr);
  }

  onConnection(handler: (connection: IConnection) => void): void {
    this.connectionHandlers.push(handler);
  }

  onDisconnection(handler: (connection: IConnection) => void): void {
    this.disconnectionHandlers.push(handler);
  }

  onMessage(handler: (connection: IConnection, message: any) => void): void {
    this.messageHandlers.push(handler);
  }

  // IActiveSessionProvider implementation
  getActiveSessionCount(): number {
    return this.getConnections().length;
  }

  getActiveSessionsCount(): number {
    // Count unique sessions
    const sessions = new Set(
      this.getConnections()
        .map(conn => conn.sessionId)
        .filter(sessionId => sessionId)
    );
    return sessions.size;
  }

  getActiveStudentCount(): number {
    return this.getStudentConnections().length;
  }

  getActiveTeacherCount(): number {
    return this.getTeacherConnections().length;
  }

  private handleConnection(connection: IConnection): void {
    // Set up message handler for this connection
    connection.onMessage((data) => {
      try {
        const message = JSON.parse(data);
        this.messageHandlers.forEach(handler => {
          try {
            handler(connection, message);
          } catch (error) {
            logger.error('Error in message handler:', { error });
          }
        });
      } catch (error) {
        logger.error('Error parsing message:', { error, data });
      }
    });

    // Notify connection handlers
    this.connectionHandlers.forEach(handler => {
      try {
        handler(connection);
      } catch (error) {
        logger.error('Error in connection handler:', { error });
      }
    });

    logger.info('Connection handled:', { connectionId: connection.id });
  }

  private handleDisconnection(connection: IConnection): void {
    // Notify disconnection handlers
    this.disconnectionHandlers.forEach(handler => {
      try {
        handler(connection);
      } catch (error) {
        logger.error('Error in disconnection handler:', { error });
      }
    });

    logger.info('Disconnection handled:', { connectionId: connection.id });
  }
}
