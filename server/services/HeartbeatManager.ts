/**
 * HeartbeatManager
 * 
 * Responsible for managing WebSocket connection heartbeats to detect and
 * terminate inactive connections.
 */

// WebSocketClient matches the type in WebSocketServer
type WebSocketClient = WebSocket & {
  isAlive: boolean;
  sessionId: string;
  on: (event: string, listener: (...args: any[]) => void) => WebSocketClient;
  terminate: () => void;
  ping: () => void;
}

export class HeartbeatManager {
  private interval: NodeJS.Timeout | null = null;
  private readonly intervalTime: number;
  
  /**
   * Creates a new HeartbeatManager
   * 
   * @param intervalTime - Time between heartbeat checks in milliseconds
   */
  constructor(intervalTime: number = 30000) {
    this.intervalTime = intervalTime;
  }
  
  /**
   * Start the heartbeat mechanism for a set of connections
   * 
   * @param connections - Set of WebSocketClient connections to monitor
   * @param onClose - Callback to execute when the heartbeat is stopped
   */
  public startHeartbeat(
    connections: Set<WebSocketClient>,
    onClose: () => void
  ): void {
    // Stop any existing interval
    this.stopHeartbeat();
    
    // Start new interval
    this.interval = setInterval(() => {
      connections.forEach(ws => {
        // Check if client is alive
        if (ws.isAlive === false) {
          console.log('Terminating inactive WebSocket connection');
          ws.terminate();
          return;
        }
        
        // Mark client as inactive - will be marked alive again if client responds with pong
        ws.isAlive = false;
        
        try {
          // Send ping to check if client is still alive
          ws.ping();
        } catch (e) {
          console.error('Error sending ping:', e);
          // Client will be terminated on next cycle if it doesn't respond
        }
      });
    }, this.intervalTime);
    
    // Set up cleanup
    if (onClose) {
      // Store in variable to ensure we can remove it later if needed
      const cleanupHandler = () => {
        this.stopHeartbeat();
        onClose();
      };
      
      // Store the handler somewhere if we need to remove it later
      this._cleanupHandler = cleanupHandler;
    }
  }
  
  /**
   * Stop the heartbeat mechanism
   */
  public stopHeartbeat(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }
  
  // Private property to store cleanup handler
  private _cleanupHandler: (() => void) | null = null;
}