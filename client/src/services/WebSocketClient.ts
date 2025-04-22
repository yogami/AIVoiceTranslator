/**
 * WebSocket Client Service
 * 
 * Handles real-time communication between teacher and student interfaces.
 * This class implements the WebSocket functionality directly to avoid circular dependencies.
 * 
 * Following SOLID principles:
 * - Single Responsibility: Handles only WebSocket communication
 * - Open/Closed: Extensible for new message types without modification
 * - Liskov Substitution: Conforms to expected WebSocket behavior
 * - Interface Segregation: Provides specific methods for specific tasks
 * - Dependency Inversion: Can be used by different components through abstractions
 */

// Connection status type
export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

// User role type
export type UserRole = 'teacher' | 'student' | 'unset';

// Message types
export interface BaseMessage {
  type: string;
  [key: string]: any;
}

export interface TranscriptionMessage extends BaseMessage {
  type: 'transcription';
  text: string;
}

export interface AudioMessage extends BaseMessage {
  type: 'audio';
  data: string;
}

export interface RegisterMessage extends BaseMessage {
  type: 'register';
  role: UserRole;
  languageCode: string;
}

export interface TranslationMessage extends BaseMessage {
  type: 'translation';
  data: {
    originalText: string;
    translatedText: string;
    languageCode: string;
    audio?: string;
  };
}

/**
 * WebSocket client for real-time communication
 */
export class WebSocketClient {
  private socket: WebSocket | null = null;
  private reconnectTimer: any = null;
  private pingInterval: any = null;
  private listeners: Map<string, Function[]> = new Map();
  private status: ConnectionStatus = 'disconnected';
  private cleanupFunctions: (() => void)[] = [];
  
  // Role management
  public currentRole: UserRole = 'unset';
  public isRoleLocked: boolean = false;
  private currentLanguage: string = 'en-US';

  constructor() {
    // No initial connection
  }
  
  /**
   * Create a WebSocket connection
   */
  private createWebSocketConnection(path: string = '/ws'): WebSocket {
    // Determine the WebSocket URL based on the current location
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const url = `${protocol}//${host}${path}`;
    
    console.log(`Creating WebSocket connection to ${url}`);
    
    // Create a new WebSocket connection
    const socket = new WebSocket(url);
    
    // Set up basic event handlers
    socket.onopen = () => {
      console.log('WebSocket connection established');
    };
    
    socket.onclose = (event) => {
      console.log(`WebSocket connection closed: ${event.code} ${event.reason}`);
    };
    
    socket.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
    
    return socket;
  }
  
  /**
   * Send a message to the WebSocket server
   */
  private wsSendMessage(socket: WebSocket, message: any): boolean {
    if (socket.readyState !== WebSocket.OPEN) {
      console.warn('Cannot send message, WebSocket is not open');
      return false;
    }
    
    try {
      socket.send(JSON.stringify(message));
      return true;
    } catch (error) {
      console.error('Failed to send message:', error);
      return false;
    }
  }
  
  /**
   * Listen for messages from the WebSocket server
   */
  private addMessageListener(
    socket: WebSocket, 
    callback: (message: any) => void
  ): () => void {
    const listener = (event: MessageEvent) => {
      try {
        const message = JSON.parse(event.data);
        callback(message);
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };
    
    socket.addEventListener('message', listener);
    
    // Return a function to remove the listener
    return () => {
      socket.removeEventListener('message', listener);
    };
  }
  
  /**
   * Keep the WebSocket connection alive
   */
  private setupHeartbeat(socket: WebSocket, interval: number = 30000): () => void {
    // Send ping message every 30 seconds
    const intervalId = setInterval(() => {
      if (socket.readyState === WebSocket.OPEN) {
        this.wsSendMessage(socket, {
          type: 'ping',
          timestamp: Date.now()
        });
      }
    }, interval);
    
    // Return a function to clear the interval
    return () => {
      clearInterval(intervalId);
    };
  }
  
  /**
   * Connect to the WebSocket server
   */
  public connect(): void {
    if (this.socket && (this.socket.readyState === WebSocket.CONNECTING || 
                         this.socket.readyState === WebSocket.OPEN)) {
      console.log('WebSocket already connected or connecting - disconnect first if you need to reconnect with new params');
      return;
    }
    
    try {
      // Build URL with query parameters
      let path = '/ws';
      const params = new URLSearchParams();
      
      if (this.currentRole !== 'unset') {
        params.append('role', this.currentRole);
      }
      
      if (this.currentLanguage) {
        params.append('language', this.currentLanguage);
      }
      
      // Add query params if we have any
      const queryString = params.toString();
      if (queryString) {
        path = `${path}?${queryString}`;
      }
      
      console.log(`[CRITICAL] Connecting WebSocket with role=${this.currentRole}, locked=${this.isRoleLocked}`);
      
      // Create the WebSocket connection
      this.socket = this.createWebSocketConnection(path);
      this.status = 'connecting';
      this.emit('status', this.status);
      
      // Set up event handlers
      this.setupSocketHandlers();
      
      // Set up heartbeat
      const heartbeatCleanup = this.setupHeartbeat(this.socket);
      this.cleanupFunctions.push(heartbeatCleanup);
    } catch (error) {
      console.error('Failed to connect to WebSocket server:', error);
      this.status = 'error';
      this.emit('status', this.status);
      this.emit('error', error);
    }
  }
  
  /**
   * Set up WebSocket event handlers
   */
  private setupSocketHandlers(): void {
    if (!this.socket) return;
    
    // Handle connection open
    this.socket.onopen = (event) => {
      console.log('WebSocket connection established with readyState:', this.socket?.readyState);
      this.status = 'connected';
      this.emit('status', this.status);
      this.emit('open', event);
      
      // If role is set, register immediately after connection
      if (this.currentRole !== 'unset') {
        this.register(this.currentRole, this.currentLanguage);
      }
    };
    
    // Handle connection close
    this.socket.onclose = (event) => {
      console.log('WebSocket connection closed:', event.code, event.reason);
      this.status = 'disconnected';
      this.emit('status', this.status);
      this.emit('close', event);
      
      // Clean up all registered functions
      this.cleanupFunctions.forEach(cleanup => cleanup());
      this.cleanupFunctions = [];
      
      // Attempt to reconnect if not intentionally disconnected
      if (event.code !== 1000) {
        this.scheduleReconnect();
      }
    };
    
    // Handle connection errors
    this.socket.onerror = (event) => {
      console.error('WebSocket error:', event);
      this.status = 'error';
      this.emit('status', this.status);
      this.emit('error', event);
    };
    
    // Add message listener
    const messageCleanup = this.addMessageListener(this.socket, (message: any) => {
      // Handle specific message types
      this.handleMessage(message);
      
      // Emit the message to listeners
      this.emit('message', message);
      
      // Emit the specific message type event
      if (message.type) {
        this.emit(message.type, message);
      }
    });
    
    // Add to cleanup functions
    this.cleanupFunctions.push(messageCleanup);
  }
  
  /**
   * Handle specific message types
   */
  private handleMessage(message: any): void {
    if (!message || !message.type) return;
    
    switch (message.type) {
      case 'connection':
        this.handleConnectionMessage(message);
        break;
        
      case 'ping':
        this.handlePingMessage(message);
        break;
        
      case 'pong':
        this.handlePongMessage(message);
        break;
        
      case 'register':
        this.handleRegisterMessage(message);
        break;
        
      case 'translation':
        // Just emit this to listeners, no special handling needed
        break;
    }
  }
  
  /**
   * Handle connection confirmation message
   */
  private handleConnectionMessage(message: any): void {
    if (message.sessionId) {
      console.log('Received connection confirmation with sessionId:', message.sessionId);
      
      // Update role if provided by server
      if (message.role) {
        console.log('Server confirmed connection with role:', message.role);
        if (!this.isRoleLocked) {
          this.currentRole = message.role as UserRole;
        }
      }
      
      // Update language if provided by server
      if (message.language) {
        console.log('Server confirmed connection with language:', message.language);
        this.currentLanguage = message.language;
      }
    }
  }
  
  /**
   * Handle ping message from server
   */
  private handlePingMessage(message: any): void {
    // Respond with a pong message
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      const pongMessage = {
        type: 'pong',
        timestamp: message.timestamp
      };
      this.wsSendMessage(this.socket, pongMessage);
    }
  }
  
  /**
   * Handle pong message from server
   */
  private handlePongMessage(message: any): void {
    // No action needed, just for debugging
  }
  
  /**
   * Handle register message from server
   */
  private handleRegisterMessage(message: any): void {
    if (message.status === 'success' && message.data) {
      // Registration successful, update local state if not locked
      if (!this.isRoleLocked && message.data.role) {
        this.currentRole = message.data.role as UserRole;
      }
      
      if (message.data.languageCode) {
        this.currentLanguage = message.data.languageCode;
      }
    }
  }
  
  /**
   * Schedule a reconnection attempt
   */
  private scheduleReconnect(): void {
    // Clear any existing timer
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }
    
    // Schedule a new reconnection attempt
    this.reconnectTimer = setTimeout(() => {
      console.log('Attempting to reconnect to WebSocket server...');
      this.connect();
    }, 5000); // Try to reconnect after 5 seconds
  }
  
  /**
   * Disconnect from the WebSocket server
   */
  public disconnect(): void {
    // Clear reconnection timer if active
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    
    // Clean up all registered functions
    this.cleanupFunctions.forEach(cleanup => cleanup());
    this.cleanupFunctions = [];
    
    // Close the socket connection
    if (this.socket) {
      if (this.socket.readyState === WebSocket.OPEN || 
          this.socket.readyState === WebSocket.CONNECTING) {
        this.socket.close(1000, 'Client disconnected');
      }
      this.socket = null;
    }
    
    this.status = 'disconnected';
    this.emit('status', this.status);
  }
  
  /**
   * Register role and language with the server
   */
  public register(role: UserRole, languageCode: string): void {
    if (this.isRoleLocked && role !== this.currentRole) {
      console.warn(`WebSocketClient: Cannot change role to ${role} because it is locked as ${this.currentRole}`);
      return;
    }
    
    this.currentRole = role;
    this.currentLanguage = languageCode;
    
    console.log(`WebSocketClient: Registering with role=${role}, languageCode=${languageCode}, roleLocked=${this.isRoleLocked}`);
    
    const message: RegisterMessage = {
      type: 'register',
      role,
      languageCode
    };
    
    this.sendMessage(message);
  }
  
  /**
   * Lock the role to prevent changes
   */
  public setRoleAndLock(role: UserRole): void {
    console.log(`WebSocketClient: Setting ${role} role and locking it`);
    this.currentRole = role;
    this.isRoleLocked = true;
  }
  
  /**
   * Send an audio message to the server
   */
  public sendAudio(audioData: string): void {
    // Ensure role is set before sending audio
    if (this.currentRole === 'unset') {
      console.error('Cannot send audio without setting a role first');
      return;
    }
    
    const message: AudioMessage = {
      type: 'audio',
      data: audioData
    };
    
    console.log(`WebSocketClient: Sending audio data, length:`, audioData.length);
    this.sendMessage(message);
    console.log(`WebSocketClient: Audio sent from role=${this.currentRole} (client role=${this.currentRole}), locked=${this.isRoleLocked}`);
  }
  
  /**
   * Send a transcription message to the server
   */
  public sendTranscription(text: string): void {
    // Ensure role is set before sending transcription
    if (this.currentRole === 'unset') {
      console.error('Cannot send transcription without setting a role first');
      return;
    }
    
    const message: TranscriptionMessage = {
      type: 'transcription',
      text
    };
    
    this.sendMessage(message);
  }
  
  /**
   * Send a message to the server
   */
  private sendMessage(message: BaseMessage): void {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      console.warn('Cannot send message, WebSocket is not connected');
      return;
    }
    
    try {
      this.wsSendMessage(this.socket, message);
    } catch (error) {
      console.error('Error sending message:', error);
      this.emit('error', error);
    }
  }
  
  /**
   * Get the current connection status
   */
  public getStatus(): ConnectionStatus {
    return this.status;
  }
  
  /**
   * Get the current role
   */
  public getRole(): UserRole {
    return this.currentRole;
  }
  
  /**
   * Get the current language
   */
  public getLanguage(): string {
    return this.currentLanguage;
  }
  
  /**
   * Get the WebSocket instance
   */
  public getSocket(): WebSocket | null {
    return this.socket;
  }
  
  /**
   * Register an event listener
   */
  public addEventListener(event: string, callback: Function): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    
    this.listeners.get(event)!.push(callback);
  }
  
  /**
   * Remove an event listener
   */
  public removeEventListener(event: string, callback: Function): void {
    if (!this.listeners.has(event)) return;
    
    const callbacks = this.listeners.get(event)!;
    const index = callbacks.indexOf(callback);
    
    if (index !== -1) {
      callbacks.splice(index, 1);
    }
  }
  
  /**
   * Emit an event to all registered listeners
   */
  private emit(event: string, ...args: any[]): void {
    if (!this.listeners.has(event)) return;
    
    const callbacks = this.listeners.get(event)!;
    callbacks.forEach(callback => {
      try {
        callback(...args);
      } catch (error) {
        console.error(`Error in event listener for "${event}":`, error);
      }
    });
  }
}