/**
 * WebSocket Utilities
 * 
 * This module provides a clean, object-oriented approach to WebSocket handling
 * following SOLID principles:
 * - Single Responsibility: Each class has one job
 * - Open/Closed: Extend functionality through decorators or strategy pattern
 * - Liskov Substitution: Subtypes are substitutable for their base types
 * - Interface Segregation: Clients use only what they need
 * - Dependency Inversion: High-level modules depend on abstractions
 */
import { WebSocketServer as WSServer, WebSocket } from 'ws';
import { Server } from 'http';
import { IncomingMessage } from 'http';

// WebSocket connection states
export const WebSocketState = {
  CONNECTING: 0,
  OPEN: 1,
  CLOSING: 2,
  CLOSED: 3
};

// Types for clearer interfaces
export type MessageHandler = (ws: ExtendedWebSocket, message: any) => void;
export type ConnectionHandler = (ws: ExtendedWebSocket, request: IncomingMessage) => void;
export type CloseHandler = (ws: ExtendedWebSocket, code: number, reason: string) => void;

// Extended WebSocket interface for tracking custom properties
export interface ExtendedWebSocket extends WebSocket {
  isAlive: boolean;
  sessionId?: string;
  role?: 'teacher' | 'student';
  languageCode?: string;
}

/**
 * WebSocketMessage interface to ensure consistent message format
 */
export interface WebSocketMessage {
  type: string;
  [key: string]: any;
}

/**
 * WebSocketServerConfig for configuration options
 */
export interface WebSocketServerConfig {
  path?: string;
  heartbeatInterval?: number;
  logLevel?: 'none' | 'error' | 'warn' | 'info' | 'debug';
}

/**
 * WebSocketService class - Encapsulates WebSocket server operations
 * Following Single Responsibility Principle: one class, one responsibility
 */
export class WebSocketService {
  private wss: WSServer;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private config: Required<WebSocketServerConfig>;
  private messageHandlers: Map<string, MessageHandler[]> = new Map();
  private connectionHandlers: ConnectionHandler[] = [];
  private closeHandlers: CloseHandler[] = [];

  // Default configuration
  private static readonly DEFAULT_CONFIG: Required<WebSocketServerConfig> = {
    path: '/ws',
    heartbeatInterval: 30000,
    logLevel: 'info'
  };

  /**
   * Creates a new WebSocketService
   */
  constructor(
    private server: Server,
    config: WebSocketServerConfig = {}
  ) {
    // Merge provided config with defaults
    this.config = {
      ...WebSocketService.DEFAULT_CONFIG,
      ...config
    };

    // Initialize WebSocket server
    this.wss = new WSServer({ 
      server: this.server, 
      path: this.config.path 
    });

    this.log('info', `WebSocket server initialized and listening on path: ${this.config.path}`);
    
    // Setup the core event handlers
    this.setupEventHandlers();
    
    // Setup heartbeat mechanism
    this.setupHeartbeat();
  }

  /**
   * Set up core WebSocket event handlers
   */
  private setupEventHandlers(): void {
    // Handle new connections
    this.wss.on('connection', (ws: WebSocket, request: IncomingMessage) => {
      // Log the headers for debugging
      this.log('debug', 'WebSocket connection verification, headers:', request.headers);
      
      const extendedWs = ws as ExtendedWebSocket;
      extendedWs.isAlive = true;
      
      // Generate a unique session ID
      extendedWs.sessionId = `session_${Date.now()}_${Math.floor(Math.random() * 100)}`;
      
      this.log('info', `New WebSocket connection from ${request.socket.remoteAddress} path: ${request.url}`);
      this.log('debug', 'Headers:', request.headers);
      
      // Handle pong messages for heartbeat
      extendedWs.on('pong', () => {
        extendedWs.isAlive = true;
      });
      
      // Handle incoming messages and route to appropriate handlers
      extendedWs.on('message', (rawData) => {
        try {
          // Parse message
          const data = rawData.toString();
          const message = JSON.parse(data);
          this.log('debug', `Received message type=${message.type || 'unknown'}`);
          
          // Process message by type
          if (message.type === 'register') {
            this.log('info', `Processing message type=${message.type} from connection: role=${message.role}, languageCode=${message.languageCode}`);
            
            // If role is changing, log it
            if (extendedWs.role !== message.role) {
              this.log('info', `Changing connection role from ${extendedWs.role} to ${message.role}`);
            }
            
            // Update connection properties
            extendedWs.role = message.role;
            extendedWs.languageCode = message.languageCode;
            
            this.log('info', `Updated connection: role=${extendedWs.role}, languageCode=${extendedWs.languageCode}`);
          }
          
          // Find and execute all registered handlers for this message type
          const handlers = this.messageHandlers.get(message.type) || [];
          handlers.forEach(handler => {
            try {
              handler(extendedWs, message);
            } catch (handlerError) {
              this.log('error', `Error in message handler for type ${message.type}:`, handlerError);
            }
          });
          
        } catch (error) {
          this.log('error', 'Error processing message:', error);
        }
      });
      
      // Handle connection close
      extendedWs.on('close', (code: number, reason: string) => {
        this.log('info', `WebSocket disconnected, sessionId: ${extendedWs.sessionId}`);
        
        // Execute close handlers
        this.closeHandlers.forEach(handler => {
          try {
            handler(extendedWs, code, reason);
          } catch (handlerError) {
            this.log('error', 'Error in close handler:', handlerError);
          }
        });
      });
      
      // Send connection confirmation
      this.sendToClient(extendedWs, {
        type: 'connection',
        sessionId: extendedWs.sessionId,
        status: 'connected',
        timestamp: Date.now()
      });
      
      this.log('info', `Sending connection confirmation with sessionId: ${extendedWs.sessionId}`);
      this.log('info', 'Connection confirmation sent successfully');
      
      // Execute connection handlers
      this.connectionHandlers.forEach(handler => {
        try {
          handler(extendedWs, request);
        } catch (handlerError) {
          this.log('error', 'Error in connection handler:', handlerError);
        }
      });
    });
    
    // Handle server close
    this.wss.on('close', () => {
      this.log('info', 'WebSocket server closed');
      this.cleanup();
    });
  }

  /**
   * Set up heartbeat mechanism to detect dead connections
   */
  private setupHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      this.wss.clients.forEach((ws: WebSocket) => {
        const extendedWs = ws as ExtendedWebSocket;
        
        if (extendedWs.isAlive === false) {
          this.log('debug', `Terminating inactive connection: ${extendedWs.sessionId}`);
          return extendedWs.terminate();
        }
        
        extendedWs.isAlive = false;
        extendedWs.ping();
      });
    }, this.config.heartbeatInterval);
  }

  /**
   * Clean up resources
   */
  private cleanup(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  /**
   * Register a message handler for a specific message type
   */
  public onMessage(type: string, handler: MessageHandler): void {
    if (!this.messageHandlers.has(type)) {
      this.messageHandlers.set(type, []);
    }
    this.messageHandlers.get(type)!.push(handler);
  }

  /**
   * Register a connection handler
   */
  public onConnection(handler: ConnectionHandler): void {
    this.connectionHandlers.push(handler);
  }

  /**
   * Register a close handler
   */
  public onClose(handler: CloseHandler): void {
    this.closeHandlers.push(handler);
  }

  /**
   * Broadcast a message to all connected clients
   */
  public broadcast(message: WebSocketMessage): void {
    this.wss.clients.forEach((client: WebSocket) => {
      if (client.readyState === WebSocketState.OPEN) {
        client.send(JSON.stringify(message));
      }
    });
  }

  /**
   * Broadcast a message to all connected clients with a specific role
   */
  public broadcastToRole(role: 'teacher' | 'student', message: WebSocketMessage): void {
    this.wss.clients.forEach((client: WebSocket) => {
      const extendedClient = client as ExtendedWebSocket;
      if (extendedClient.readyState === WebSocketState.OPEN && extendedClient.role === role) {
        client.send(JSON.stringify(message));
      }
    });
  }

  /**
   * Send a message to a specific client
   */
  public sendToClient(client: ExtendedWebSocket, message: WebSocketMessage): void {
    if (client.readyState === WebSocketState.OPEN) {
      client.send(JSON.stringify(message));
    }
  }

  /**
   * Get all connected clients
   */
  public getClients(): Set<WebSocket> {
    return this.wss.clients;
  }

  /**
   * Get the WebSocket server instance
   */
  public getServer(): WSServer {
    return this.wss;
  }

  /**
   * Get clients with a specific role
   */
  public getClientsByRole(role: 'teacher' | 'student'): ExtendedWebSocket[] {
    const clients: ExtendedWebSocket[] = [];
    this.wss.clients.forEach((client: WebSocket) => {
      const extendedClient = client as ExtendedWebSocket;
      if (extendedClient.role === role) {
        clients.push(extendedClient);
      }
    });
    return clients;
  }

  /**
   * Simple logging utility that respects the configured log level
   */
  private log(level: 'debug' | 'info' | 'warn' | 'error', message: string, ...args: any[]): void {
    const logLevels = {
      'none': 0,
      'error': 1,
      'warn': 2,
      'info': 3,
      'debug': 4
    };
    
    if (logLevels[level] <= logLevels[this.config.logLevel]) {
      switch (level) {
        case 'debug':
          console.log(message, ...args);
          break;
        case 'info':
          console.log(message, ...args);
          break;
        case 'warn':
          console.warn(message, ...args);
          break;
        case 'error':
          console.error(message, ...args);
          break;
      }
    }
  }
}

/**
 * Factory function for backward compatibility
 */
export function createWebSocketServer(server: Server, path: string = '/ws'): WebSocketService {
  return new WebSocketService(server, { path });
}

/**
 * Broadcast function for backward compatibility
 */
export function broadcastMessage(wss: WSServer | WebSocketService, message: any): void {
  if (wss instanceof WebSocketService) {
    wss.broadcast(message);
  } else {
    wss.clients.forEach((client: WebSocket) => {
      if (client.readyState === WebSocketState.OPEN) {
        client.send(JSON.stringify(message));
      }
    });
  }
}

/**
 * SendToClient function for backward compatibility
 */
export function sendToClient(client: WebSocket, message: any): void {
  if (client.readyState === WebSocketState.OPEN) {
    client.send(JSON.stringify(message));
  }
}