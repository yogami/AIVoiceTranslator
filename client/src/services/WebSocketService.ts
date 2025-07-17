/**
 * WebSocket Service
 * 
 * Provides a clean, type-safe interface for WebSocket communication
 * between the client and server.
 */

import { clientConfig } from '../config/client-config.js';

export type UserRole = 'teacher' | 'student';

export interface WebSocketMessage {
  type: string;
  [key: string]: any;
}

export interface RegisterMessage extends WebSocketMessage {
  type: 'register';
  role: UserRole;
  languageCode: string;
  classroomCode?: string;
}

export interface TranscriptionMessage extends WebSocketMessage {
  type: 'transcription';
  text: string;
  timestamp: number;
  isFinal: boolean;
}

export interface TranslationMessage extends WebSocketMessage {
  type: 'translation';
  originalText?: string;
  text?: string;
  translatedText?: string;
  audioData?: string;
}

export interface ClassroomCodeMessage extends WebSocketMessage {
  type: 'classroom_code';
  code: string;
  expiresAt?: string;
}

export interface ErrorMessage extends WebSocketMessage {
  type: 'error';
  message: string;
}

type MessageHandler = (message: WebSocketMessage) => void;

export class WebSocketService {
  private ws: WebSocket | null = null;
  private messageHandlers: Map<string, MessageHandler[]> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = clientConfig.websocket.maxReconnectAttempts;
  private reconnectDelay = clientConfig.websocket.reconnectDelay;
  private isIntentionallyClosed = false;

  constructor(
    private role: UserRole,
    private languageCode: string,
    private classroomCode?: string
  ) {}

  /**
   * Connect to the WebSocket server
   */
  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const wsUrl = (import.meta as any).env.VITE_WS_URL;
      if (!wsUrl) {
        throw new Error('VITE_WS_URL environment variable must be set.');
      }
      const params = this.classroomCode ? `?code=${this.classroomCode}` : '';
      const fullUrl = `${wsUrl}${params}`;

      this.ws = new WebSocket(fullUrl);
      this.isIntentionallyClosed = false;

      this.ws.onopen = () => {
        console.log('WebSocket connected');
        this.reconnectAttempts = 0;
        this.register();
        resolve();
      };

      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          this.handleMessage(message);
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      this.ws.onclose = () => {
        console.log('WebSocket disconnected');
        if (!this.isIntentionallyClosed && this.reconnectAttempts < this.maxReconnectAttempts) {
          this.reconnect();
        }
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        reject(error);
      };
    });
  }

  /**
   * Disconnect from the WebSocket server
   */
  disconnect(): void {
    this.isIntentionallyClosed = true;
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  /**
   * Register with the server
   */
  private register(): void {
    const message: RegisterMessage = {
      type: 'register',
      role: this.role,
      languageCode: this.languageCode,
    };

    if (this.classroomCode) {
      message.classroomCode = this.classroomCode;
    }

    this.send(message);
  }

  /**
   * Send a message through the WebSocket
   */
  send(message: WebSocketMessage): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      console.warn('WebSocket is not connected');
    }
  }

  /**
   * Subscribe to a specific message type
   */
  on(messageType: string, handler: MessageHandler): () => void {
    if (!this.messageHandlers.has(messageType)) {
      this.messageHandlers.set(messageType, []);
    }
    
    this.messageHandlers.get(messageType)!.push(handler);

    // Return unsubscribe function
    return () => {
      const handlers = this.messageHandlers.get(messageType);
      if (handlers) {
        const index = handlers.indexOf(handler);
        if (index > -1) {
          handlers.splice(index, 1);
        }
      }
    };
  }

  /**
   * Handle incoming messages
   */
  private handleMessage(message: WebSocketMessage): void {
    // Handle ping/pong
    if (message.type === 'ping') {
      this.send({ type: 'pong', timestamp: Date.now() });
      return;
    }

    // Call registered handlers
    const handlers = this.messageHandlers.get(message.type);
    if (handlers) {
      handlers.forEach(handler => handler(message));
    }

    // Call wildcard handlers
    const wildcardHandlers = this.messageHandlers.get('*');
    if (wildcardHandlers) {
      wildcardHandlers.forEach(handler => handler(message));
    }
  }

  /**
   * Reconnect to the WebSocket server
   */
  private reconnect(): void {
    this.reconnectAttempts++;
    console.log(`Reconnecting... (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
    
    setTimeout(() => {
      this.connect().catch(error => {
        console.error('Reconnection failed:', error);
      });
    }, this.reconnectDelay);
  }

  /**
   * Update language preference
   */
  updateLanguage(languageCode: string): void {
    this.languageCode = languageCode;
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.register();
    }
  }

  /**
   * Get connection state
   */
  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }
}