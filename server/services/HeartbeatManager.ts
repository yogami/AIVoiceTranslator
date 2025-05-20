/**
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
}