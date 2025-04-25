/**
 * WebSocketClient for Benedictaitor
 * Implementation with proper dependency injection following SOLID principles:
 * - Single Responsibility: Each class has a specific purpose
 * - Open/Closed: Extensible through factories and interfaces
 * - Liskov Substitution: Implementations are substitutable
 * - Interface Segregation: Clear interfaces define client needs
 * - Dependency Inversion: High-level modules depend on abstractions
 */

/**
 * WebSocket connection states
 * Using a constant enum for better type safety and readability
 */
export const WebSocketState = {
  CONNECTING: 0,
  OPEN: 1,
  CLOSING: 2,
  CLOSED: 3
};

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

// WebSocket Factory Interface for dependency injection
export interface WebSocketFactory {
  createWebSocket(url: string): WebSocket;
}

// Default WebSocket Factory implementation
class DefaultWebSocketFactory implements WebSocketFactory {
  createWebSocket(url: string): WebSocket {
    return new WebSocket(url);
  }
}

// WebSocket Client Interface
export interface IWebSocketClient {
  connect(): Promise<void>;
  disconnect(): void;
  register(role: UserRole, languageCode: string): void;
  setRoleAndLock(role: UserRole): void;
  sendTranscription(text: string): boolean;
  addEventListener(type: WebSocketEventType, callback: WebSocketEventListener): void;
  removeEventListener(type: WebSocketEventType, callback: WebSocketEventListener): void;
  getStatus(): ConnectionStatus;
  getSessionId(): string | null;
  getRole(): UserRole | null;
  getLanguageCode(): string;
  getSocket(): WebSocket | null;
  readonly isRoleLocked: boolean;
  readonly currentRole: UserRole | null;
}

// Concrete WebSocketClient implementation
export class WebSocketClient implements IWebSocketClient {
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
  private roleLocked: boolean = false;
  
  // Inject dependencies through constructor
  constructor(
    private webSocketFactory: WebSocketFactory = new DefaultWebSocketFactory(),
    private wsPath: string = '/ws'
  ) {}
  
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
        const wsUrl = `${protocol}//${host}${this.wsPath}`;
        
        console.log(`[WebSocketClient] Connecting to ${wsUrl}`);
        // Use factory to create WebSocket - allows for easier mocking during tests
        this.ws = this.webSocketFactory.createWebSocket(wsUrl);

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

    if (this.ws.readyState === WebSocketState.OPEN) {
      this.ws.close(1000, 'Client disconnected');
    }
  }

  /**
   * Register role and language preference
   */
  public register(role: UserRole, languageCode: string): void {
    if (!this.ws || this.ws.readyState !== WebSocketState.OPEN) {
      console.warn('[WebSocketClient] Cannot register - not connected');
      return;
    }

    // If role is locked, don't change it, but update language code
    if (this.roleLocked && this.role) {
      console.log(`[WebSocketClient] Role is locked as ${this.role}, not changing to ${role}`);
      // Only update language
      this.languageCode = languageCode;
      
      // Send register message with current locked role but new language
      const message: WebSocketMessage = {
        type: 'register',
        role: this.role,
        languageCode
      };
      
      this.send(message);
      console.log(`[WebSocketClient] Updated language to ${languageCode} (role remains ${this.role})`);
    } else {
      // Normal flow - update both role and language
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
  }
  
  /**
   * Set role and lock it to prevent changes
   */
  public setRoleAndLock(role: UserRole): void {
    console.log(`[WebSocketClient] Setting role to ${role} and locking it`);
    this.role = role;
    this.roleLocked = true;
    
    // If connected, also register with the server
    if (this.ws && this.ws.readyState === WebSocketState.OPEN) {
      this.register(role, this.languageCode);
    }
  }

  /**
   * Send transcription message
   * @returns boolean indicating success
   */
  public sendTranscription(text: string): boolean {
    if (!this.ws || this.ws.readyState !== WebSocketState.OPEN) {
      console.warn('[WebSocketClient] Cannot send transcription - not connected');
      return false;
    }

    if (this.role !== 'teacher') {
      console.warn('[WebSocketClient] Only teachers can send transcriptions');
      return false;
    }

    try {
      const message: WebSocketMessage = {
        type: 'transcription',
        text
      };

      console.log(`[WebSocketClient] Sending transcription: "${text}"`);
      this.send(message);
      return true;
    } catch (error) {
      console.error('[WebSocketClient] Error sending transcription:', error);
      return false;
    }
  }

  /**
   * Send raw message
   */
  private send(message: WebSocketMessage): void {
    if (!this.ws || this.ws.readyState !== WebSocketState.OPEN) {
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
      if (this.ws && this.ws.readyState === WebSocketState.OPEN) {
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
   * Get the WebSocket instance
   */
  public getSocket(): WebSocket | null {
    return this.ws;
  }
  
  /**
   * Get whether the role is locked
   */
  public get isRoleLocked(): boolean {
    return this.roleLocked;
  }
  
  /**
   * Get the current role
   */
  public get currentRole(): UserRole | null {
    return this.role;
  }
}

// WebSocket service factory for improved testability and dependency injection
export class WebSocketService {
  private static instance: WebSocketClient | null = null;
  
  // Factory method to create a new WebSocketClient (or reuse the existing one)
  public static createClient(
    webSocketFactory?: WebSocketFactory,
    wsPath?: string
  ): WebSocketClient {
    if (!WebSocketService.instance) {
      WebSocketService.instance = new WebSocketClient(
        webSocketFactory || new DefaultWebSocketFactory(),
        wsPath || '/ws'
      );
    }
    return WebSocketService.instance;
  }
  
  // Reset the instance (for testing purposes)
  public static resetClient(): void {
    if (WebSocketService.instance) {
      WebSocketService.instance.disconnect();
      WebSocketService.instance = null;
    }
  }
}

// Create and export a default client for backwards compatibility
export const webSocketClient = WebSocketService.createClient();
// For backwards compatibility with imports using { wsClient }
export const wsClient = webSocketClient;

// Define the TranslationPayload type for exports
export interface TranslationPayload {
  type: string;
  text?: string;
  translatedText?: string;
  originalLanguage?: string;
  translatedLanguage?: string;
  audio?: string;
  timestamp?: string | number;
  latency?: number;
  isFinal?: boolean;
  [key: string]: any;
}