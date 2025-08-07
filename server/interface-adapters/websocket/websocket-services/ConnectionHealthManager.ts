/**
 * Connection Health Manager
 * 
 * Manages WebSocket connection health monitoring, heartbeat, and dead connection detection.
 * Handles the health aspect of WebSocket connections.
 */
import logger from '../../logger';
import { config } from '../../config';
import { WebSocketClient } from './ConnectionManager';
import { WebSocketServer as WSServer } from 'ws';

export class ConnectionHealthManager {
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private wss: WSServer;

  constructor(wss: WSServer) {
    this.wss = wss;
    this.setupHeartbeat();
  }

  /**
   * Set up heartbeat mechanism to detect dead connections
   */
  private setupHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      this.wss.clients.forEach((ws: any) => {
        const client = ws as WebSocketClient;
        
        if (!client.isAlive) {
          logger.info('Terminating dead connection', { sessionId: client.sessionId });
          return client.terminate();
        }
        
        // Mark as not alive and send ping
        client.isAlive = false;
        client.ping();
        
        // Also send a JSON ping message for clients that don't handle ping frames
        try {
          client.send(JSON.stringify({ type: 'ping', timestamp: Date.now() }));
        } catch (error) {
          // Ignore send errors - connection might be closing
          logger.debug('Failed to send ping message, connection might be closing');
        }
      });
    }, config.session.healthCheckInterval);
  }

  /**
   * Mark a connection as alive (called when pong received)
   */
  public markAlive(client: WebSocketClient): void {
    client.isAlive = true;
  }

  /**
   * Initialize connection health tracking
   */
  public initializeConnection(client: WebSocketClient): void {
    // Mark as alive initially
    client.isAlive = true;

    // Set up pong handler for heartbeat
    client.on('pong', () => {
      this.markAlive(client);
    });
  }

  /**
   * Get connection health status
   */
  public isConnectionAlive(client: WebSocketClient): boolean {
    return client.isAlive ?? false;
  }

  /**
   * Get health metrics for all connections
   */
  public getHealthMetrics(): {
    totalConnections: number;
    aliveConnections: number;
    deadConnections: number;
  } {
    let totalConnections = 0;
    let aliveConnections = 0;
    let deadConnections = 0;

    this.wss.clients.forEach((ws: any) => {
      const client = ws as WebSocketClient;
      totalConnections++;
      
      if (client.isAlive) {
        aliveConnections++;
      } else {
        deadConnections++;
      }
    });

    return {
      totalConnections,
      aliveConnections,
      deadConnections
    };
  }

  /**
   * Shutdown the health manager
   */
  public shutdown(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    logger.info('ConnectionHealthManager shutdown completed');
  }

  /**
   * Start heartbeat monitoring (public method for external control)
   */
  public startHeartbeat(): void {
    if (!this.heartbeatInterval) {
      this.setupHeartbeat();
    }
  }

  /**
   * Stop heartbeat monitoring (public method for external control)
   */
  public stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  /**
   * Check connection health for all connections
   */
  public checkConnectionHealth(): void {
    const metrics = this.getHealthMetrics();
    logger.info('Connection health check completed', metrics);
  }

  /**
   * Clean up dead connections
   */
  public cleanupDeadConnections(): void {
    this.wss.clients.forEach((ws: any) => {
      const client = ws as WebSocketClient;
      if (!client.isAlive) {
        logger.info('Cleaning up dead connection', { sessionId: client.sessionId });
        client.terminate();
      }
    });
  }

  /**
   * Get count of healthy connections
   */
  public getHealthyConnectionCount(): number {
    return this.getHealthMetrics().aliveConnections;
  }

  /**
   * Get total connection count
   */
  public getTotalConnectionCount(): number {
    return this.getHealthMetrics().totalConnections;
  }
}
