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
  private maxReconnectAttempts = 5;
  private reconnectTimeout: number | null = null;
  private listeners: Map<string, ((data: any) => void)[]> = new Map();
  private status: WebSocketStatus = 'disconnected';
  private sessionId: string | null = null;
  private role: UserRole = 'student';
  private languageCode: string = 'en-US';

  constructor() {
    this.setupEventHandlers = this.setupEventHandlers.bind(this);
  }

  public connect() {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    this.status = 'connecting';
    this.notifyListeners('status', this.status);

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    
    console.log(`Connecting to WebSocket at ${wsUrl}`);
    this.ws = new WebSocket(wsUrl);
    this.setupEventHandlers();
  }

  private setupEventHandlers() {
    if (!this.ws) return;

    this.ws.onopen = () => {
      console.log('WebSocket connection established');
      this.status = 'connected';
      this.reconnectAttempts = 0;
      this.notifyListeners('status', this.status);
      
      // Register with server
      this.register(this.role, this.languageCode);
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        // Handle initial connection confirmation
        if (data.type === 'connection' && data.status === 'connected' && data.sessionId) {
          this.sessionId = data.sessionId;
          this.notifyListeners('sessionId', this.sessionId);
        }
        
        // Notify all listeners for this message type
        this.notifyListeners(data.type, data);
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    };

    this.ws.onclose = () => {
      console.log('WebSocket connection closed');
      this.status = 'disconnected';
      this.notifyListeners('status', this.status);
      this.attemptReconnect();
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      this.status = 'disconnected';
      this.notifyListeners('status', this.status);
      this.notifyListeners('error', error);
    };
  }

  private attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('Max reconnect attempts reached');
      return;
    }

    const delay = Math.min(1000 * 2 ** this.reconnectAttempts, 30000);
    console.log(`Attempting to reconnect in ${delay}ms`);
    
    if (this.reconnectTimeout !== null) {
      clearTimeout(this.reconnectTimeout);
    }
    
    this.reconnectTimeout = window.setTimeout(() => {
      this.reconnectAttempts++;
      this.connect();
    }, delay);
  }

  public disconnect() {
    if (this.ws) {
      this.ws.close();
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
    
    try {
      return this.send({
        type: 'audio',
        payload: {
          audio: audioData
        }
      });
    } catch (err) {
      console.error('WebSocketClient: Error sending audio data:', err);
      return false;
    }
  }

  public register(role: UserRole, languageCode: string) {
    this.role = role;
    this.languageCode = languageCode;
    
    return this.send({
      type: 'register',
      payload: {
        role,
        languageCode
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

  public getStatus() {
    return this.status;
  }

  public getSessionId() {
    return this.sessionId;
  }
}

// Create a singleton instance
export const wsClient = new WebSocketClient();
