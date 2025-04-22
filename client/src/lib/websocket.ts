// WebSocket client implementation

export type WebSocketStatus = 'connecting' | 'connected' | 'disconnected';
export type UserRole = 'teacher' | 'student';

export interface WebSocketMessage {
  type: string;
  payload?: any;
  [key: string]: any;
}

export interface AudioPayload {
  audio: string; // base64 encoded audio data
}

export interface TranslationPayload {
  sessionId: string;
  sourceLanguage: string;
  targetLanguage: string;
  originalText: string;
  translatedText: string;
  audio: string; // base64 encoded audio
  timestamp: string;
  latency: number;
}

export class WebSocketClient {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10; // Increased max attempts
  private reconnectTimeout: number | null = null;
  private listeners: Map<string, ((data: any) => void)[]> = new Map();
  private status: WebSocketStatus = 'disconnected';
  private sessionId: string | null = null;
  private role: UserRole = 'student';
  private languageCode: string = 'en-US';
  private roleLocked: boolean = false; // Flag to prevent role from being changed after initial setting
  
  // Make role and roleLocked accessible for diagnostics and status checking
  public get currentRole(): UserRole { return this.role; }
  public get isRoleLocked(): boolean { return this.roleLocked; }
  
  // Get the WebSocket instance for direct access if needed
  public getSocket(): WebSocket | null { return this.ws; }

  constructor() {
    this.setupEventHandlers = this.setupEventHandlers.bind(this);
  }

  public connect() {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      console.log('WebSocket already connected or connecting - disconnect first if you need to reconnect with new params');
      return;
    }

    this.status = 'connecting';
    this.notifyListeners('status', this.status);

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    
    // Include role and language as query parameters for immediate server-side role assignment
    const params = new URLSearchParams();
    
    // EMERGENCY FIX: Always use this.role directly for connection
    const connectionRole = this.role;
    console.log(`[CRITICAL] Connecting WebSocket with role=${connectionRole}, locked=${this.roleLocked}`);
    params.append('role', connectionRole);
    
    params.append('language', this.languageCode);
    const wsUrl = `${protocol}//${window.location.host}/ws?${params.toString()}`;
    
    // Double-check the URL doesn't have any issues
    if (connectionRole === 'teacher' && !wsUrl.includes('role=teacher')) {
      console.error('CRITICAL ERROR: URL does not contain teacher role! Manual override required.');
      const forcedUrl = `${protocol}//${window.location.host}/ws?role=teacher&language=${this.languageCode}`;
      console.log(`Forcing URL to: ${forcedUrl}`);
      this.ws = new WebSocket(forcedUrl);
    } else {
      console.log(`Connecting to WebSocket at ${wsUrl} with explicit query params: role=${params.get('role')}, language=${params.get('language')}`);
      this.ws = new WebSocket(wsUrl);
    }
    
    this.setupEventHandlers();
  }

  // Keep-alive ping interval reference
  private keepAlivePingInterval: number | null = null;
  
  // Store last pong received time for connection health monitoring
  private lastPongReceived: number = 0;
  
  // Start sending keep-alive pings to prevent timeouts
  private startKeepAlivePing() {
    // Clear any existing ping interval
    this.stopKeepAlivePing();
    
    // Initialize the last pong time
    this.lastPongReceived = Date.now();
    
    // Send a ping every 5 seconds to align with server's 5-second ping interval
    this.keepAlivePingInterval = window.setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        // Check if we've received a pong in the last 15 seconds
        const timeSinceLastPong = Date.now() - this.lastPongReceived;
        if (timeSinceLastPong > 15000) {
          console.warn(`No pong received in ${timeSinceLastPong}ms, connection may be stale`);
          
          // Force reconnection if we haven't received a pong in a while
          this.ws.close(3000, "No pong received");
          this.attemptReconnect();
          return;
        }
        
        console.log('Sending WebSocket keep-alive ping');
        try {
          // Send a simple ping message
          this.send({
            type: 'ping',
            timestamp: Date.now()
          });
        } catch (err) {
          console.error('Error sending keep-alive ping:', err);
          // If sending fails, try to reconnect
          this.attemptReconnect();
        }
      } else {
        console.warn('Cannot send keep-alive ping, WebSocket not open (readyState: ' + 
                    (this.ws ? this.ws.readyState : 'null') + ')');
        
        // If connection is lost, attempt to reconnect
        if (!this.ws || (this.ws.readyState !== WebSocket.CONNECTING && this.ws.readyState !== WebSocket.OPEN)) {
          console.log('Connection appears lost, attempting reconnect');
          this.attemptReconnect();
        }
      }
    }, 5000); // 5 seconds to match server's interval
  }
  
  // Stop the keep-alive pings
  private stopKeepAlivePing() {
    if (this.keepAlivePingInterval !== null) {
      clearInterval(this.keepAlivePingInterval);
      this.keepAlivePingInterval = null;
    }
  }
  
  private setupEventHandlers() {
    if (!this.ws) return;

    this.ws.onopen = () => {
      console.log('WebSocket connection established with readyState:', this.ws?.readyState);
      this.status = 'connected';
      this.reconnectAttempts = 0;
      this.notifyListeners('status', this.status);
      
      // Add a small delay before sending the registration
      // This helps ensure the server is fully ready to process our message
      setTimeout(() => {
        console.log('Registering with server after connection delay');
        // Register with server
        this.register(this.role, this.languageCode);
        
        // Add a keep-alive ping to prevent the connection from timing out
        this.startKeepAlivePing();
      }, 500);
    };

    this.ws.onmessage = (event) => {
      try {
        console.log('WebSocket message received:', event.data.slice(0, 100) + (event.data.length > 100 ? '...' : ''));
        const data = JSON.parse(event.data);
        
        // Handle various keep-alive messages
        if (data.type === 'pong' || data.type === 'ping') {
          console.log(`Received ${data.type} from server`);
          this.lastPongReceived = Date.now();
          
          // If we received a ping, respond with a pong
          if (data.type === 'ping') {
            console.log('Responding to server ping with pong');
            this.send({
              type: 'pong',
              timestamp: Date.now()
            });
          }
        }
        
        // Handle initial connection confirmation
        if (data.type === 'connection' && data.status === 'connected' && data.sessionId) {
          console.log('Received connection confirmation with sessionId:', data.sessionId);
          this.sessionId = data.sessionId;
          this.notifyListeners('sessionId', this.sessionId);
          
          // Update pong time to prevent immediate timeout
          this.lastPongReceived = Date.now();
          
          // Store server-provided role and language if available
          if (data.role) {
            console.log(`Server confirmed connection with role: ${data.role}`);
            
            // Only override our role if it's not locked
            if (!this.roleLocked) {
              this.role = data.role;
              
              // Auto-lock the role if it's set to 'teacher'
              if (data.role === 'teacher') {
                console.log('Auto-locking role as teacher from server confirmation');
                this.roleLocked = true;
              }
            } else if (this.role !== data.role) {
              console.warn(`Server sent role ${data.role} but client has locked role ${this.role}. Keeping ${this.role}.`);
              
              // Re-register with our locked role to ensure server is updated
              setTimeout(() => {
                this.register(this.role, this.languageCode);
              }, 100);
            }
          }
          
          if (data.languageCode) {
            console.log(`Server confirmed connection with language: ${data.languageCode}`);
            this.languageCode = data.languageCode;
          }
        }
        
        // Handle role verification messages
        if (data.type === 'processing_complete' && data.data && data.data.roleConfirmed) {
          console.log(`Server processed audio as role: ${data.data.role}`);
          
          // Check for role mismatch
          if (data.data.role !== this.role) {
            console.warn(`Role mismatch detected! Server has ${data.data.role}, client has ${this.role}`);
            
            if (this.roleLocked) {
              // Re-register our locked role
              console.log(`Re-registering locked role ${this.role}`);
              this.register(this.role, this.languageCode);
            }
          }
        }
        
        // Notify all listeners for this message type
        this.notifyListeners(data.type, data);
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    };

    this.ws.onclose = (event) => {
      console.log(`WebSocket connection closed - Code: ${event.code}, Reason: ${event.reason || 'No reason provided'}, Clean: ${event.wasClean}`);
      console.log('WebSocket readyState at close:', this.ws?.readyState);
      
      this.status = 'disconnected';
      this.notifyListeners('status', this.status);
      
      // Log common WebSocket close codes
      if (event.code === 1000) {
        console.log('Normal closure - The connection successfully completed the operation');
      } else if (event.code === 1001) {
        console.log('Going away - The endpoint is going away (server shutdown or browser page navigation)');
      } else if (event.code === 1002) {
        console.log('Protocol error - The endpoint terminated due to a protocol error');
      } else if (event.code === 1003) {
        console.log('Unsupported data - The endpoint terminated because it received data of a type it cannot accept');
      } else if (event.code === 1005) {
        console.log('No status received - No status code was received in the close');
      } else if (event.code === 1006) {
        console.log('Abnormal closure - The connection was closed abnormally (e.g., without sending a close frame)');
      } else if (event.code === 1007) {
        console.log('Invalid frame payload data - The endpoint terminated because a message contained data inconsistent with its type');
      } else if (event.code === 1008) {
        console.log('Policy violation - The endpoint terminated because it received a message that violates its policy');
      } else if (event.code === 1009) {
        console.log('Message too big - The endpoint terminated because it received a message too large to process');
      } else if (event.code === 1010) {
        console.log('Missing extension - The client terminated because it expected the server to negotiate an extension it did not');
      } else if (event.code === 1011) {
        console.log('Internal error - The server terminated because it encountered an unexpected condition');
      } else if (event.code === 1015) {
        console.log('TLS handshake failure - The connection was closed due to a TLS handshake failure');
      }
      
      this.attemptReconnect();
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      console.log('WebSocket readyState at error:', this.ws?.readyState);
      this.status = 'disconnected';
      this.notifyListeners('status', this.status);
      this.notifyListeners('error', error);
    };
  }

  private attemptReconnect() {
    // Reset and create a new connection if we hit max attempts
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('Max reconnect attempts reached, resetting connection and trying once more');
      this.stopKeepAlivePing();
      this.reconnectAttempts = 0;
      if (this.ws) {
        try {
          // Force close the existing socket if it's still around
          this.ws.close();
        } catch (err) {
          console.error('Error closing socket during reset:', err);
        }
        this.ws = null;
      }
    }

    // Use exponential backoff with a minimum of 1s and maximum of 5s
    const delay = Math.min(1000 * Math.pow(1.5, this.reconnectAttempts), 5000);
    console.log(`Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts + 1}/${this.maxReconnectAttempts})`);
    
    if (this.reconnectTimeout !== null) {
      clearTimeout(this.reconnectTimeout);
    }
    
    this.reconnectTimeout = window.setTimeout(() => {
      this.reconnectAttempts++;
      
      // Make sure we're actually disconnected before trying to reconnect
      if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
        console.log('Reconnect not needed - already connected or connecting');
        return;
      }
      
      // Clean up any existing socket
      if (this.ws) {
        try {
          this.ws.close();
        } catch (err) {
          console.error('Error closing existing socket before reconnect:', err);
        }
        this.ws = null;
      }
      
      console.log('Executing reconnect attempt');
      this.status = 'connecting';
      this.notifyListeners('status', this.status);
      this.connect();
    }, delay);
  }

  public disconnect() {
    // Stop the keep-alive ping interval
    this.stopKeepAlivePing();
    
    if (this.ws) {
      // Send a clean disconnect message if possible
      try {
        if (this.ws.readyState === WebSocket.OPEN) {
          // Using code 1000 (normal closure) for clean disconnection
          this.ws.close(1000, "Client initiated disconnect");
        }
      } catch (err) {
        console.error('Error during clean disconnect:', err);
      }
      this.ws = null;
    }
    
    if (this.reconnectTimeout !== null) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    
    this.status = 'disconnected';
    this.notifyListeners('status', this.status);
  }

  public send(message: WebSocketMessage) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
      return true;
    }
    return false;
  }

  public sendAudio(audioData: string) {
    console.log('WebSocketClient: Sending audio data, length:', audioData.length);
    
    // Only send if we're connected
    if (this.status !== 'connected') {
      console.warn('WebSocketClient: Cannot send audio - not connected');
      return false;
    }
    
    // CRITICAL: If this is a teacher interface, always force the role to be 'teacher'
    let audioRole = this.role;
    if (this.roleLocked) {
      audioRole = 'teacher';
    }
    
    // Log current role and locked state to verify
    console.log(`WebSocketClient: Audio sent from role=${audioRole} (client role=${this.role}), locked=${this.roleLocked}`);
    
    try {
      // Include role both at top level and in payload for maximum compatibility
      return this.send({
        type: 'audio',
        role: audioRole, // Top-level role field
        payload: {
          audio: audioData,
          role: audioRole  // Explicitly include role in payload for validation
        }
      });
    } catch (err) {
      console.error('WebSocketClient: Error sending audio data:', err);
      return false;
    }
  }
  
  /**
   * Send transcription text directly to the server (used by Web Speech API implementation)
   * This bypasses the audio processing pipeline and sends text directly for translation
   * @param text The transcribed text to send for translation
   * @returns true if the message was sent successfully, false otherwise
   */
  public sendTranscription(text: string) {
    console.log('WebSocketClient: Sending transcription text:', text.substring(0, 100) + (text.length > 100 ? '...' : ''));
    
    // Only send if we're connected
    if (this.status !== 'connected') {
      console.warn('WebSocketClient: Cannot send transcription - not connected');
      return false;
    }
    
    // Force teacher role for transcriptions regardless of current role
    // This is a critical fix to ensure transcriptions are always accepted
    if (this.role !== 'teacher') {
      console.warn('WebSocketClient: Forcing teacher role for transcription - current role is:', this.role);
      // Temporarily override the role for this operation
      const originalRole = this.role;
      this.role = 'teacher';
      
      // After sending, we'll restore the original role if not locked
      setTimeout(() => {
        if (!this.roleLocked) {
          console.log('WebSocketClient: Restoring original role after transcription');
          this.role = originalRole;
        }
      }, 500);
    }
    
    try {
      // CRITICAL FIX: Send both 'webSpeechTranscription' AND 'transcription' messages
      // This ensures compatibility with both message handlers on the server
      
      // First send 'webSpeechTranscription' to store the text for audio processing
      console.log('WebSocketClient: Sending webSpeechTranscription with text:', text.substring(0, 30) + (text.length > 30 ? '...' : ''));
      this.send({
        type: 'webSpeechTranscription',
        payload: {
          text: text,
          timestamp: Date.now(),
          languageCode: this.languageCode
        }
      });
      
      // Then send 'transcription' for immediate display
      console.log('WebSocketClient: Sending transcription...');
      return this.send({
        type: 'transcription',
        payload: {
          text: text,
          role: this.role,
          languageCode: this.languageCode
        }
      });
    } catch (err) {
      console.error('WebSocketClient: Error sending transcription:', err);
      return false;
    }
  }

  public register(role: UserRole, languageCode: string) {
    // Special handling for teacher role
    if (role === 'teacher') {
      console.log(`WebSocketClient: Setting teacher role and locking it`);
      this.role = 'teacher';
      this.roleLocked = true;
    } 
    // Only allow role to be changed if it's not locked
    else if (!this.roleLocked && this.role !== role) {
      console.log(`WebSocketClient: Changing role from ${this.role} to ${role}`);
      this.role = role;
    }
    // If role is locked but requested role is different, warn and keep the locked role
    else if (this.roleLocked && role !== this.role) {
      console.warn(`WebSocketClient: Role change from '${this.role}' to '${role}' rejected - role is locked`);
    }
    
    // Always update language if different
    if (this.languageCode !== languageCode) {
      console.log(`WebSocketClient: Changing language from ${this.languageCode} to ${languageCode}`);
      this.languageCode = languageCode;
    }
    
    // Always send the register message to update the server
    console.log(`WebSocketClient: Registering with role=${this.role}, languageCode=${languageCode}, roleLocked=${this.roleLocked}`);
    
    // If we need to reconnect to change URL, do so
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      // If we're connected with role=student in URL but need to be teacher, reconnect
      const url = this.ws.url;
      if (this.role === 'teacher' && url.includes('role=student')) {
        console.log('Need to reconnect with correct role in URL');
        this.disconnect();
        setTimeout(() => this.connect(), 500);
        return true;
      }
    }
    
    return this.send({
      type: 'register',
      payload: {
        role: this.role,
        languageCode,
        roleLocked: this.roleLocked
      }
    });
  }

  public requestTranscripts(sessionId: string, languageCode: string) {
    return this.send({
      type: 'transcript_request',
      payload: {
        sessionId,
        languageCode
      }
    });
  }

  public addEventListener(eventType: string, callback: (data: any) => void) {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, []);
    }
    
    this.listeners.get(eventType)?.push(callback);
  }

  public removeEventListener(eventType: string, callback: (data: any) => void) {
    if (!this.listeners.has(eventType)) return;
    
    const callbacks = this.listeners.get(eventType);
    if (callbacks) {
      const index = callbacks.indexOf(callback);
      if (index !== -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  private notifyListeners(eventType: string, data: any) {
    const callbacks = this.listeners.get(eventType);
    if (callbacks) {
      callbacks.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in WebSocket event listener for "${eventType}":`, error);
        }
      });
    }
  }

  public getStatus(): WebSocketStatus {
    return this.status;
  }

  public getSessionId() {
    return this.sessionId;
  }
  
  /**
   * Explicitly set the role and lock it to prevent any changes
   * This is used for critical roles like 'teacher' that shouldn't change
   */
  public setRoleAndLock(role: UserRole): boolean {
    console.log(`WebSocketClient: Setting role to '${role}' and locking it`);
    // Set the role
    this.role = role;
    this.roleLocked = true;
    
    // Disconnect and reconnect if we're already connected with the wrong role in the URL
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      const url = this.ws.url;
      if (role === 'teacher' && url.includes('role=student')) {
        console.log('Critical: Current WebSocket URL has role=student but we need teacher. Reconnecting...');
        this.disconnect();
        setTimeout(() => this.connect(), 500);
        return true;
      }
    }
    
    // Register with the server if we're connected
    if (this.status === 'connected') {
      return this.send({
        type: 'register',
        payload: {
          role: this.role,
          languageCode: this.languageCode,
          roleLocked: true // Explicitly tell server this role is locked
        }
      });
    }
    
    // If not connected, make sure we'll connect with the right role
    if (this.status === 'disconnected') {
      setTimeout(() => this.connect(), 100);
    }
    
    return this.roleLocked;
  }
}

// Create a singleton instance
export const wsClient = new WebSocketClient();

// Make the WebSocket client available globally for debugging and status access
declare global {
  interface Window {
    wsClient: WebSocketClient;
  }
}

// Set the global instance
if (typeof window !== 'undefined') {
  window.wsClient = wsClient;
}
