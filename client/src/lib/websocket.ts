/**
 * WebSocketClient for Benedictaitor
 * Singleton implementation for shared WebSocket connection
 */

export type UserRole = 'teacher' | 'student';
export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';
export type MessageType = 'connection' | 'register' | 'transcription' | 'translation' | 'ping' | 'pong';

export interface WebSocketMessage {
  type: MessageType;
  sessionId?: string;
  role?: UserRole;
  languageCode?: string;
  text?: string;
  originalLanguage?: string;
  translatedLanguage?: string;
  timestamp?: number;
  error?: string;
}

export type WebSocketEventType = 'open' | 'close' | 'error' | 'message' | 'status' | 'translation';
export type WebSocketEventListener = (data?: any) => void;

class WebSocketClient {
  private static instance: WebSocketClient | null = null;
  private ws: WebSocket | null = null;
  private sessionId: string | null = null;
  private role: UserRole | null = null;
  private languageCode: string = 'en-US';
  private status: ConnectionStatus = 'disconnected';
  private eventListeners: Map<WebSocketEventType, Set<WebSocketEventListener>> = new Map();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private pingInterval: ReturnType<typeof setInterval> | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  private constructor() {
    // Private constructor for singleton
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): WebSocketClient {
    if (!WebSocketClient.instance) {
      WebSocketClient.instance = new WebSocketClient();
    }
    return WebSocketClient.instance;
  }

  /**
   * Connect to WebSocket server
   */
  public connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.status === 'connected' || this.status === 'connecting') {
        console.warn('[WebSocketClient] Already connected or connecting');
        resolve();
        return;
      }

      this.setStatus('connecting');

      // Create WebSocket connection
      try {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = window.location.host;
        const wsUrl = `${protocol}//${host}/ws`;
        
        console.log(`[WebSocketClient] Connecting to ${wsUrl}`);
        this.ws = new WebSocket(wsUrl);

        // Connection opened
        this.ws.onopen = () => {
          console.log('[WebSocketClient] Connection established');
          this.setStatus('connected');
          this.reconnectAttempts = 0;
          this.setupPingInterval();
          this.notifyListeners('open');
          resolve();
        };

        // Listen for messages
        this.ws.onmessage = (event) => {
          try {
            const message: WebSocketMessage = JSON.parse(event.data);
            console.log('[WebSocketClient] Received message:', message);

            // Handle connection message with session ID
            if (message.type === 'connection' && message.sessionId) {
              this.sessionId = message.sessionId;
              console.log(`[WebSocketClient] Session ID: ${this.sessionId}`);
            }

            // Handle translation message
            if (message.type === 'translation') {
              this.notifyListeners('translation', message);
            }

            this.notifyListeners('message', message);
          } catch (error) {
            console.error('[WebSocketClient] Error parsing message:', error);
          }
        };

        // Connection closed
        this.ws.onclose = (event) => {
          console.log(`[WebSocketClient] Connection closed: ${event.code} ${event.reason || 'No reason'}`);
          this.setStatus('disconnected');
          this.cleanupConnection();
          this.notifyListeners('close', event);

          // Attempt to reconnect
          if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectTimer = setTimeout(() => {
              this.reconnectAttempts++;
              console.log(`[WebSocketClient] Reconnecting (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
              this.connect().catch(console.error);
            }, 3000);
          } else {
            console.warn('[WebSocketClient] Max reconnect attempts reached');
            reject(new Error('Failed to reconnect after maximum attempts'));
          }
        };

        // Connection error
        this.ws.onerror = (error) => {
          console.error('[WebSocketClient] WebSocket error:', error);
          this.setStatus('error');
          this.notifyListeners('error', error);
          reject(error);
        };
      } catch (error) {
        console.error('[WebSocketClient] Failed to create WebSocket:', error);
        this.setStatus('error');
        reject(error);
      }
    });
  }

  /**
   * Disconnect from WebSocket server
   */
  public disconnect(): void {
    if (!this.ws || this.status === 'disconnected') {
      console.warn('[WebSocketClient] Not connected');
      return;
    }

    this.cleanupConnection();

    if (this.ws.readyState === WebSocket.OPEN) {
      this.ws.close(1000, 'Client disconnected');
    }
  }

  /**
   * Register role and language preference
   */
  public register(role: UserRole, languageCode: string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn('[WebSocketClient] Cannot register - not connected');
      return;
    }

    this.role = role;
    this.languageCode = languageCode;

    const message: WebSocketMessage = {
      type: 'register',
      role,
      languageCode
    };

    this.send(message);
    console.log(`[WebSocketClient] Registered as ${role} with language ${languageCode}`);
  }

  /**
   * Send transcription message
   */
  public sendTranscription(text: string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn('[WebSocketClient] Cannot send transcription - not connected');
      return;
    }

    if (this.role !== 'teacher') {
      console.warn('[WebSocketClient] Only teachers can send transcriptions');
      return;
    }

    const message: WebSocketMessage = {
      type: 'transcription',
      text
    };

    this.send(message);
  }

  /**
   * Send raw message
   */
  private send(message: WebSocketMessage): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn('[WebSocketClient] Cannot send message - not connected');
      return;
    }

    try {
      this.ws.send(JSON.stringify(message));
    } catch (error) {
      console.error('[WebSocketClient] Error sending message:', error);
    }
  }

  /**
   * Add event listener
   */
  public addEventListener(type: WebSocketEventType, callback: WebSocketEventListener): void {
    if (!this.eventListeners.has(type)) {
      this.eventListeners.set(type, new Set());
    }
    this.eventListeners.get(type)?.add(callback);
  }

  /**
   * Remove event listener
   */
  public removeEventListener(type: WebSocketEventType, callback: WebSocketEventListener): void {
    const listeners = this.eventListeners.get(type);
    if (listeners) {
      listeners.delete(callback);
      if (listeners.size === 0) {
        this.eventListeners.delete(type);
      }
    }
  }

  /**
   * Notify all listeners of an event
   */
  private notifyListeners(type: WebSocketEventType, data?: any): void {
    const listeners = this.eventListeners.get(type);
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`[WebSocketClient] Error in ${type} listener:`, error);
        }
      });
    }
  }

  /**
   * Set connection status and notify listeners
   */
  private setStatus(status: ConnectionStatus): void {
    if (this.status !== status) {
      this.status = status;
      this.notifyListeners('status', status);
    }
  }

  /**
   * Send ping to keep connection alive
   */
  private setupPingInterval(): void {
    // Clear any existing ping interval
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
    }

    // Send ping every 30 seconds
    this.pingInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.send({
          type: 'ping',
          timestamp: Date.now()
        });
      }
    }, 30000);
  }

  /**
   * Clean up connection resources
   */
  private cleanupConnection(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  /**
   * Get current connection status
   */
  public getStatus(): ConnectionStatus {
    return this.status;
  }

  /**
   * Get session ID
   */
  public getSessionId(): string | null {
    return this.sessionId;
  }

  /**
   * Get current role
   */
  public getRole(): UserRole | null {
    return this.role;
  }

  /**
   * Get language code
   */
  public getLanguageCode(): string {
    return this.languageCode;
  }

  /**
   * Reset the singleton instance (for testing purposes)
   */
  public static resetInstance(): void {
    if (WebSocketClient.instance) {
      WebSocketClient.instance.disconnect();
      WebSocketClient.instance = null;
    }
  }
}

// Export the singleton instance
export const webSocketClient = WebSocketClient.getInstance();