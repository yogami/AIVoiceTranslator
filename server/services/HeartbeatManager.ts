/**
<<<<<<< HEAD
 * Manages WebSocket heartbeat to detect and terminate inactive connections.
 */
import { WebSocketServer as WSServer, WebSocket } from 'ws';

export class HeartbeatManager {
  private heartbeatInterval: NodeJS.Timeout | null = null;

  constructor(private wss: WSServer) {
    this.setupHeartbeat();
  }

  private setupHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      this.wss.clients.forEach((ws: WebSocket) => {
        if (!ws || !(ws as any).isAlive) {
          console.log('Terminating inactive connection');
          return ws?.terminate();
        }
        (ws as any).isAlive = false;
        if (ws.readyState === WebSocket.OPEN) {
          try {
            ws.ping();
          } catch (error) {
            console.error('Error during ping:', error);
          }
        } else {
          console.warn('Skipping ping: WebSocket is not open');
        }
      });
    }, 30000);
  }

  cleanup(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }
=======
 * HeartbeatManager Class
 * 
 * Responsible for maintaining WebSocket connections and detecting inactive clients
 * through a ping/pong mechanism.
 */

import { WebSocket } from 'ws';

// Extended WebSocket type with additional properties
export interface HeartbeatWebSocket extends WebSocket {
  isAlive: boolean;
  sessionId?: string;
}

export class HeartbeatManager {
  private interval: NodeJS.Timeout | null = null;
  private readonly heartbeatIntervalMs: number;
  
  /**
   * Create a new HeartbeatManager
   * 
   * @param heartbeatIntervalMs - Milliseconds between heartbeat checks (default: 30000ms / 30s)
   */
  constructor(heartbeatIntervalMs: number = 30000) {
    this.heartbeatIntervalMs = heartbeatIntervalMs;
  }

  /**
   * Start the heartbeat mechanism for a set of WebSocket connections
   * 
   * @param connections - Set of WebSocket connections to monitor
   * @param onTerminate - Optional callback function to execute when a connection is terminated
   * @returns The interval ID for cleanup purposes
   */
  public start(
    connections: Set<HeartbeatWebSocket>,
    onTerminate?: (ws: HeartbeatWebSocket) => void
  ): NodeJS.Timeout {
    // Clear any existing interval
    if (this.interval) {
      clearInterval(this.interval);
    }
    
    // Set up new interval
    this.interval = setInterval(() => {
      connections.forEach(ws => {
        this.checkConnection(ws, onTerminate);
      });
    }, this.heartbeatIntervalMs);
    
    return this.interval;
  }
  
  /**
   * Check a single connection and ping if active
   * 
   * @param ws - WebSocket connection to check
   * @param onTerminate - Optional callback when connection is terminated
   */
  public checkConnection(
    ws: HeartbeatWebSocket,
    onTerminate?: (ws: HeartbeatWebSocket) => void
  ): void {
    // If connection was already marked as inactive, terminate it
    if (ws.isAlive === false) {
      console.log('Terminating inactive WebSocket connection');
      ws.terminate();
      
      // Execute callback if provided
      if (onTerminate) {
        onTerminate(ws);
      }
      return;
    }
    
    // Mark as inactive first - will be marked active again when pong is received
    ws.isAlive = false;
    
    try {
      // Send ping to check if client is alive
      ws.ping();
    } catch (e) {
      console.error('Error sending ping:', e);
      // ws.isAlive remains false, connection will be terminated on next cycle
    }
  }
  
  /**
   * Stop the heartbeat mechanism
   */
  public stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }
  
  /**
   * Mark a connection as alive (typically called when a pong is received)
   * 
   * @param ws - WebSocket connection to mark as alive
   */
  public markAlive(ws: HeartbeatWebSocket): void {
    ws.isAlive = true;
  }
>>>>>>> 81a840f9553b7b18b803139e2cb47f7a89eceea2
}