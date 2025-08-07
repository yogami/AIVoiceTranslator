/**
 * WebSocket Protocol Implementation
 * 
 * Implements the communication protocol abstraction for WebSocket connections.
 * This adapter allows the main application logic to be protocol-agnostic.
 * 
 * SOLID Principles:
 * - Single Responsibility: Pure WebSocket protocol adapter
 * - Interface Segregation: Implements only communication protocol interface
 * - Dependency Inversion: Adapts WebSocket to abstract protocol interface
 */

import { WebSocketServer as WSServer, WebSocket } from 'ws';
import * as http from 'http';
import logger from '../../logger';
import { 
  IConnection, 
  ICommunicationServer, 
  ICommunicationProtocol 
} from './ICommunicationProtocol';

export class WebSocketConnection implements IConnection {
  public readonly id: string;
  public sessionId?: string;
  public role?: string;
  public language?: string;
  public settings?: any;
  
  private messageHandlers: ((data: string) => void)[] = [];
  private closeHandlers: (() => void)[] = [];
  private errorHandlers: ((error: Error) => void)[] = [];

  constructor(private ws: WebSocket, id: string) {
    this.id = id;
    this.setupEventHandlers();
  }

  get isConnected(): boolean {
    return this.ws.readyState === WebSocket.OPEN;
  }

  async send(message: string): Promise<void> {
    if (!this.isConnected) {
      throw new Error('Connection is not open');
    }
    
    return new Promise((resolve, reject) => {
      this.ws.send(message, (error) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
  }

  async close(): Promise<void> {
    return new Promise((resolve) => {
      if (this.ws.readyState === WebSocket.CLOSED) {
        resolve();
        return;
      }
      
      this.ws.once('close', () => resolve());
      this.ws.close();
    });
  }

  onMessage(handler: (data: string) => void): void {
    this.messageHandlers.push(handler);
  }

  onClose(handler: () => void): void {
    this.closeHandlers.push(handler);
  }

  onError(handler: (error: Error) => void): void {
    this.errorHandlers.push(handler);
  }

  private setupEventHandlers(): void {
    this.ws.on('message', (data) => {
      const message = data.toString();
      this.messageHandlers.forEach(handler => {
        try {
          handler(message);
        } catch (error) {
          logger.error('Error in message handler:', { error });
        }
      });
    });

    this.ws.on('close', () => {
      this.closeHandlers.forEach(handler => {
        try {
          handler();
        } catch (error) {
          logger.error('Error in close handler:', { error });
        }
      });
    });

    this.ws.on('error', (error) => {
      this.errorHandlers.forEach(handler => {
        try {
          handler(error);
        } catch (error) {
          logger.error('Error in error handler:', { error });
        }
      });
    });
  }
}

export class WebSocketCommunicationServer implements ICommunicationServer {
  private wss: WSServer;
  private connections = new Map<string, WebSocketConnection>();
  private connectionHandlers: ((connection: IConnection) => void)[] = [];
  private disconnectionHandlers: ((connection: IConnection) => void)[] = [];
  private connectionIdCounter = 0;

  constructor(private httpServer?: http.Server, private options?: any) {
    this.wss = new WSServer({ 
      server: httpServer,
      ...options 
    });
  }

  async start(): Promise<void> {
    return new Promise((resolve) => {
      this.wss.on('connection', (ws: WebSocket, request) => {
        this.handleConnection(ws, request);
      });
      
      logger.info('WebSocket communication server started');
      resolve();
    });
  }

  async stop(): Promise<void> {
    return new Promise((resolve) => {
      // Close all connections
      for (const connection of this.connections.values()) {
        connection.close().catch(error => {
          logger.error('Error closing connection:', { error });
        });
      }
      
      // Close the server
      this.wss.close(() => {
        logger.info('WebSocket communication server stopped');
        resolve();
      });
    });
  }

  getConnections(): IConnection[] {
    return Array.from(this.connections.values());
  }

  getConnection(id: string): IConnection | undefined {
    return this.connections.get(id);
  }

  getConnectionCount(): number {
    return this.connections.size;
  }

  getTeacherConnections(): IConnection[] {
    return this.getConnectionsByRole('teacher');
  }

  getStudentConnections(): IConnection[] {
    return this.getConnectionsByRole('student');
  }

  getConnectionsByRole(role: string): IConnection[] {
    return Array.from(this.connections.values())
      .filter(conn => conn.role === role);
  }

  getConnectionsBySession(sessionId: string): IConnection[] {
    return Array.from(this.connections.values())
      .filter(conn => conn.sessionId === sessionId);
  }

  async broadcast(message: string): Promise<void> {
    const promises = Array.from(this.connections.values())
      .filter(conn => conn.isConnected)
      .map(conn => conn.send(message).catch(error => {
        logger.error('Error broadcasting message:', { error, connectionId: conn.id });
      }));
    
    await Promise.allSettled(promises);
  }

  async broadcastToRole(role: string, message: string): Promise<void> {
    const promises = this.getConnectionsByRole(role)
      .filter(conn => conn.isConnected)
      .map(conn => conn.send(message).catch(error => {
        logger.error('Error broadcasting to role:', { error, role, connectionId: conn.id });
      }));
    
    await Promise.allSettled(promises);
  }

  async broadcastToSession(sessionId: string, message: string): Promise<void> {
    const promises = this.getConnectionsBySession(sessionId)
      .filter(conn => conn.isConnected)
      .map(conn => conn.send(message).catch(error => {
        logger.error('Error broadcasting to session:', { error, sessionId, connectionId: conn.id });
      }));
    
    await Promise.allSettled(promises);
  }

  onConnection(handler: (connection: IConnection) => void): void {
    this.connectionHandlers.push(handler);
  }

  onDisconnection(handler: (connection: IConnection) => void): void {
    this.disconnectionHandlers.push(handler);
  }

  private handleConnection(ws: WebSocket, request?: any): void {
    const connectionId = `ws-${++this.connectionIdCounter}-${Date.now()}`;
    const connection = new WebSocketConnection(ws, connectionId);
    
    this.connections.set(connectionId, connection);
    
    // Set up disconnection handler
    connection.onClose(() => {
      this.connections.delete(connectionId);
      this.disconnectionHandlers.forEach(handler => {
        try {
          handler(connection);
        } catch (error) {
          logger.error('Error in disconnection handler:', { error });
        }
      });
    });
    
    // Notify connection handlers
    this.connectionHandlers.forEach(handler => {
      try {
        handler(connection);
      } catch (error) {
        logger.error('Error in connection handler:', { error });
      }
    });
    
    logger.info('New connection established:', { connectionId });
  }
}

export class WebSocketProtocol implements ICommunicationProtocol {
  readonly name = 'websocket';

  createServer(httpServer?: any, options?: any): ICommunicationServer {
    return new WebSocketCommunicationServer(httpServer, options);
  }

  async createClient(url: string, options?: any): Promise<IConnection> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(url, options);
      const connectionId = `client-${Date.now()}-${Math.random()}`;
      
      ws.on('open', () => {
        const connection = new WebSocketConnection(ws, connectionId);
        resolve(connection);
      });
      
      ws.on('error', reject);
    });
  }
}
