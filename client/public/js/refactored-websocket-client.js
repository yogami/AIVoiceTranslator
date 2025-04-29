/**
 * WebSocketClient for AIVoiceTranslator
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
const WebSocketState = {
  CONNECTING: 0,
  OPEN: 1,
  CLOSING: 2,
  CLOSED: 3
};

/**
 * WebSocketClient class that handles communication with the server
 * Refactored to reduce complexity by breaking down into smaller methods
 */
class WebSocketClient {
  /**
   * Constructor with dependency injection
   * @param {Object} webSocketFactory - Factory for creating WebSocket objects
   * @param {string} wsPath - WebSocket endpoint path
   */
  constructor(
    webSocketFactory = new DefaultWebSocketFactory(),
    wsPath = '/ws'
  ) {
    this.webSocketFactory = webSocketFactory;
    this.wsPath = wsPath;
    
    // Connection state
    this.ws = null;
    this.sessionId = null;
    this.role = null;
    this.languageCode = 'en-US';
    this.status = 'disconnected';
    
    // Event handling
    this.eventListeners = new Map();
    
    // Reconnection settings
    this.reconnectTimer = null;
    this.pingInterval = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.roleLocked = false;
  }

  /**
   * Connect to WebSocket server
   * @returns {Promise<void>} - Resolves when connection is established
   */
  connect() {
    return new Promise((resolve, reject) => {
      if (this.isConnectedOrConnecting()) {
        console.warn('[WebSocketClient] Already connected or connecting');
        resolve();
        return;
      }

      this.setStatus('connecting');
      
      try {
        this.createWebSocketConnection();
        this.setupEventHandlers(resolve, reject);
      } catch (error) {
        this.handleConnectionError(error, reject);
      }
    });
  }
  
  /**
   * Check if client is already connected or in connecting state
   * @returns {boolean} - True if connected or connecting
   */
  isConnectedOrConnecting() {
    return this.status === 'connected' || this.status === 'connecting';
  }
  
  /**
   * Create the WebSocket connection
   */
  createWebSocketConnection() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}${this.wsPath}`;
    
    console.log(`[WebSocketClient] Connecting to ${wsUrl}`);
    this.ws = this.webSocketFactory.createWebSocket(wsUrl);
  }
  
  /**
   * Set up all WebSocket event handlers
   * @param {Function} resolve - Promise resolve function
   * @param {Function} reject - Promise reject function
   */
  setupEventHandlers(resolve, reject) {
    if (!this.ws) return;
    
    this.ws.onopen = () => this.handleConnectionOpen(resolve);
    this.ws.onmessage = (event) => this.handleMessage(event);
    this.ws.onclose = (event) => this.handleConnectionClose(event, reject);
    this.ws.onerror = (error) => this.handleConnectionError(error, reject);
  }
  
  /**
   * Handle successful connection opening
   * @param {Function} resolve - Promise resolve function
   */
  handleConnectionOpen(resolve) {
    console.log('[WebSocketClient] Connection established');
    this.setStatus('connected');
    this.reconnectAttempts = 0;
    this.setupPingInterval();
    this.notifyListeners('open');
    resolve();
  }
  
  /**
   * Handle incoming WebSocket messages
   * @param {MessageEvent} event - WebSocket message event
   */
  handleMessage(event) {
    try {
      const message = JSON.parse(event.data);
      console.log('[WebSocketClient] Received message:', message);

      this.processMessageByType(message);
      this.notifyListeners('message', message);
    } catch (error) {
      console.error('[WebSocketClient] Error parsing message:', error);
    }
  }
  
  /**
   * Process message based on its type
   * @param {Object} message - Parsed WebSocket message
   */
  processMessageByType(message) {
    // Handle connection message with session ID
    if (message.type === 'connection' && message.sessionId) {
      this.sessionId = message.sessionId;
      console.log(`[WebSocketClient] Session ID: ${this.sessionId}`);
    }

    // Handle translation message
    if (message.type === 'translation') {
      this.notifyListeners('translation', message);
    }
  }
  
  /**
   * Handle WebSocket connection closing
   * @param {CloseEvent} event - WebSocket close event
   * @param {Function} reject - Promise reject function
   */
  handleConnectionClose(event, reject) {
    console.log(`[WebSocketClient] Connection closed: ${event.code} ${event.reason || 'No reason'}`);
    this.setStatus('disconnected');
    this.cleanupConnection();
    this.notifyListeners('close', event);

    this.attemptReconnection(reject);
  }
  
  /**
   * Attempt to reconnect to the server
   * @param {Function} reject - Promise reject function
   */
  attemptReconnection(reject) {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.scheduleReconnection();
    } else {
      console.warn('[WebSocketClient] Max reconnect attempts reached');
      reject(new Error('Failed to reconnect after maximum attempts'));
    }
  }
  
  /**
   * Schedule a reconnection attempt
   */
  scheduleReconnection() {
    this.reconnectTimer = setTimeout(() => {
      this.reconnectAttempts++;
      console.log(`[WebSocketClient] Reconnecting (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
      this.connect().catch(console.error);
    }, 3000);
  }
  
  /**
   * Handle WebSocket connection error
   * @param {Event} error - WebSocket error event
   * @param {Function} reject - Promise reject function
   */
  handleConnectionError(error, reject) {
    console.error('[WebSocketClient] WebSocket error:', error);
    this.setStatus('error');
    this.notifyListeners('error', error);
    reject(error);
  }
  
  /**
   * Set up ping interval to keep connection alive
   */
  setupPingInterval() {
    this.pingInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocketState.OPEN) {
        this.send({ type: 'ping' });
      }
    }, 30000); // 30 seconds
  }
  
  /**
   * Cleanup connection resources
   */
  cleanupConnection() {
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
   * Disconnect from WebSocket server
   */
  disconnect() {
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
   * Update connection status and notify listeners
   * @param {string} status - New connection status
   */
  setStatus(status) {
    this.status = status;
    this.notifyListeners('status', status);
  }
  
  /**
   * Notify all listeners of a specific event type
   * @param {string} type - Event type
   * @param {any} data - Event data
   */
  notifyListeners(type, data) {
    if (!this.eventListeners.has(type)) return;
    
    this.eventListeners.get(type).forEach(listener => {
      try {
        listener(data);
      } catch (error) {
        console.error(`[WebSocketClient] Error in ${type} event listener:`, error);
      }
    });
  }
  
  /**
   * Send data to the WebSocket server
   * @param {Object} data - Data to send
   * @returns {boolean} - True if data was sent successfully
   */
  send(data) {
    if (!this.ws || this.ws.readyState !== WebSocketState.OPEN) {
      console.warn('[WebSocketClient] Cannot send - not connected');
      return false;
    }
    
    try {
      this.ws.send(JSON.stringify(data));
      return true;
    } catch (error) {
      console.error('[WebSocketClient] Error sending data:', error);
      return false;
    }
  }
  
  /**
   * Add event listener
   * @param {string} type - Event type
   * @param {Function} callback - Event callback function
   */
  addEventListener(type, callback) {
    if (!this.eventListeners.has(type)) {
      this.eventListeners.set(type, new Set());
    }
    
    this.eventListeners.get(type).add(callback);
  }
  
  /**
   * Remove event listener
   * @param {string} type - Event type
   * @param {Function} callback - Event callback function to remove
   */
  removeEventListener(type, callback) {
    if (!this.eventListeners.has(type)) return;
    
    this.eventListeners.get(type).delete(callback);
  }
  
  /**
   * Get current connection status
   * @returns {string} - Connection status
   */
  getStatus() {
    return this.status;
  }
  
  /**
   * Get session ID
   * @returns {string|null} - Session ID or null if not connected
   */
  getSessionId() {
    return this.sessionId;
  }
}

// Default WebSocket Factory implementation
class DefaultWebSocketFactory {
  createWebSocket(url) {
    return new WebSocket(url);
  }
}
