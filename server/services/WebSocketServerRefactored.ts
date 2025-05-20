/**
 * WebSocketServer - Refactored Implementation
 * 
 * Handles real-time communication between teachers and students with improved:
 * - Separation of concerns
 * - Error handling
 * - Testability
 * - Code organization
 */

import { Server } from 'http';
import { WebSocketServer as WSServer, WebSocket } from 'ws';
import { WebSocketClient, WebSocketClientManager } from './WebSocketClientManager';
import { WebSocketMessageRouter } from './WebSocketMessageRouter';

// Message handlers
import { RegistrationMessageHandler } from './handlers/RegistrationMessageHandler';
import { TranscriptionMessageHandler } from './handlers/TranscriptionMessageHandler';
import { TTSMessageHandler } from './handlers/TTSMessageHandler';
import { AudioMessageHandler } from './handlers/AudioMessageHandler';
import { PingMessageHandler } from './handlers/PingMessageHandler';

export class WebSocketServer {
  private wss: WSServer;
  private clientManager: WebSocketClientManager;
  private messageRouter: WebSocketMessageRouter;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  
  constructor(server: Server) {
    // Initialize WebSocket server
    this.wss = new WSServer({ 
      server,
      path: '/ws',
      // CORS handling for WebSocket
      verifyClient: (info, callback) => {
        // Allow all origins for WebSocket connections
        console.log('WebSocket connection verification, headers:', 
          JSON.stringify(info.req.headers, null, 2));
        callback(true);
      }
    });
    
    // Initialize client manager
    this.clientManager = new WebSocketClientManager();
    
    // Initialize message router
    this.messageRouter = new WebSocketMessageRouter(this.clientManager);
    
    // Register message handlers
    this.registerMessageHandlers();
    
    // Set up event handlers
    this.setupEventHandlers();
    
    console.log('WebSocket server initialized and listening on path: /ws');
  }
  
  /**
   * Register message handlers with the router
   */
  private registerMessageHandlers(): void {
    // Registration handler
    this.messageRouter.registerHandler(new RegistrationMessageHandler(this.clientManager));
    
    // Transcription handler
    this.messageRouter.registerHandler(new TranscriptionMessageHandler(this.clientManager));
    
    // TTS handler
    this.messageRouter.registerHandler(new TTSMessageHandler(this.clientManager));
    
    // Audio handler
    this.messageRouter.registerHandler(new AudioMessageHandler(this.clientManager));
    
    // Ping handler
    this.messageRouter.registerHandler(new PingMessageHandler(this.clientManager));
  }
  
  /**
   * Set up WebSocket event handlers
   */
  private setupEventHandlers(): void {
    // Handle new connections
    this.wss.on('connection', (ws: WebSocket, request) => {
      this.handleConnection(ws as WebSocketClient, request);
    });
    
    // Set up heartbeat to detect dead connections
    this.setupHeartbeat();
  }
  
  /**
   * Handle new WebSocket connection
   */
  private handleConnection(ws: WebSocketClient, request: any): void {
    try {
      // Log connection information
      console.log('New WebSocket connection from', 
        request.socket.remoteAddress, 'path:', request.url);
      
      // Parse URL for initial parameters (role, language)
      const url = new URL(request.url, `http://${request.headers.host}`);
      const role = url.searchParams.get('role');
      const language = url.searchParams.get('language');
      
      // Register client with the manager
      const sessionId = this.clientManager.registerClient(ws, role || undefined, language || undefined);
      
      // Set up WebSocket event handlers
      ws.isAlive = true;
      
      // Message handler
      ws.on('message', (message: Buffer) => {
        this.handleMessage(ws, message);
      });
      
      // Close handler
      ws.on('close', () => {
        this.handleClose(ws);
      });
      
      // Error handler
      ws.on('error', (error) => {
        console.error('WebSocket error:', error);
      });
      
      // Pong handler for heartbeat
      ws.on('pong', () => {
        ws.isAlive = true;
      });
      
      // Send connection confirmation
      this.sendConnectionConfirmation(ws);
    } catch (error) {
      console.error('Error handling new connection:', error);
    }
  }
  
  /**
   * Send connection confirmation to client
   */
  private sendConnectionConfirmation(ws: WebSocketClient): void {
    try {
      const state = this.clientManager.getClientState(ws);
      
      if (!state) {
        console.error('Cannot send confirmation - client state not found');
        return;
      }
      
      const message = {
        type: 'connection',
        status: 'connected',
        sessionId: state.sessionId,
        role: state.role,
        language: state.language
      };
      
      ws.send(JSON.stringify(message));
    } catch (error) {
      console.error('Error sending connection confirmation:', error);
    }
  }
  
  /**
   * Handle incoming WebSocket message
   */
  private async handleMessage(ws: WebSocketClient, message: Buffer): Promise<void> {
    try {
      // Route message to appropriate handler
      await this.messageRouter.routeMessage(ws, message.toString());
    } catch (error) {
      console.error('Error handling message:', error);
    }
  }
  
  /**
   * Handle WebSocket close event
   */
  private handleClose(ws: WebSocketClient): void {
    try {
      console.log('WebSocket connection closed, sessionId:', ws.sessionId);
      
      // Remove client from manager
      this.clientManager.removeClient(ws);
    } catch (error) {
      console.error('Error handling connection close:', error);
    }
  }
  
  /**
   * Set up heartbeat mechanism to detect dead connections
   */
  private setupHeartbeat(): void {
    // Clear any existing interval
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    
    // Set up new interval (30 seconds)
    this.heartbeatInterval = setInterval(() => {
      // Get all clients
      const clients = this.clientManager.getAllClients();
      
      for (const clientState of clients) {
        const ws = clientState.connection;
        
        if (ws.isAlive === false) {
          console.log('Terminating inactive WebSocket connection');
          this.clientManager.removeClient(ws);
          ws.terminate();
          continue;
        }
        
        // Mark as not alive (will be marked alive when pong is received)
        ws.isAlive = false;
        ws.ping();
      }
    }, 30000);
  }
  
  /**
   * Clean up resources when server is shutting down
   */
  public close(): void {
    // Clear heartbeat interval
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    
    // Close WebSocket server
    this.wss.close();
    
    console.log('WebSocket server closed');
  }
  
  /**
   * Get the total number of connected clients
   */
  public getConnectionCount(): number {
    return this.clientManager.getTotalClientCount();
  }
  
  /**
   * Get the number of connected clients by role
   */
  public getConnectionCountByRole(role: string): number {
    return this.clientManager.getClientCountByRole(role);
  }
  
  /**
   * Get the WebSocket server instance
   */
  public getServer(): WSServer {
    return this.wss;
  }
}