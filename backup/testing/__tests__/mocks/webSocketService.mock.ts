import { WebSocketMessage, WebSocketStatus, UserRole } from '../../client/src/lib/websocket';

export class MockWebSocketService {
  private static instance: MockWebSocketService;
  private status: WebSocketStatus = 'disconnected';
  private listeners: Map<string, ((data: any) => void)[]> = new Map();
  private sessionId: string | null = null;
  private role: UserRole = 'student';
  private languageCode: string = 'en-US';
  private roleLocked: boolean = false;
  private lastSentMessage: WebSocketMessage | null = null;
  private shouldFailNextConnection: boolean = false;
  private connectionDelay: number = 0;

  // For verification in tests
  public sentMessages: WebSocketMessage[] = [];
  public audioData: string[] = [];
  public transcriptionTexts: string[] = [];

  constructor() {
    // Reset all stored data
    this.listeners = new Map();
    this.sentMessages = [];
    this.audioData = [];
    this.transcriptionTexts = [];
  }

  public static getInstance(): MockWebSocketService {
    if (!MockWebSocketService.instance) {
      MockWebSocketService.instance = new MockWebSocketService();
    }
    return MockWebSocketService.instance;
  }

  public reset(): void {
    this.status = 'disconnected';
    this.listeners = new Map();
    this.sessionId = null;
    this.role = 'student';
    this.languageCode = 'en-US';
    this.roleLocked = false;
    this.lastSentMessage = null;
    this.shouldFailNextConnection = false;
    this.connectionDelay = 0;
    this.sentMessages = [];
    this.audioData = [];
    this.transcriptionTexts = [];
  }

  public connect(): Promise<boolean> {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        if (this.shouldFailNextConnection) {
          this.shouldFailNextConnection = false;
          this.status = 'disconnected';
          this.notifyListeners('error', { error: 'Connection failed' });
          reject(new Error('Connection failed'));
        } else {
          this.status = 'connected';
          this.sessionId = `test_session_${Date.now()}`;
          this.notifyListeners('connect', { sessionId: this.sessionId });
          resolve(true);
        }
      }, this.connectionDelay);
    });
  }

  public disconnect(): boolean {
    this.status = 'disconnected';
    this.notifyListeners('disconnect', {});
    return true;
  }

  public send(message: WebSocketMessage): boolean {
    this.lastSentMessage = message;
    this.sentMessages.push(message);
    
    // Simulate a response for testing
    if (message.type === 'register') {
      this.notifyListeners('register', {
        type: 'register',
        status: 'success',
        data: {
          role: message.payload?.role || this.role,
          languageCode: message.payload?.languageCode || this.languageCode
        }
      });
    }
    
    return true;
  }

  public sendAudio(audioData: string): boolean {
    this.audioData.push(audioData);
    return this.send({
      type: 'audio',
      payload: {
        audio: audioData,
        role: this.role,
        languageCode: this.languageCode
      }
    });
  }

  public sendTranscription(text: string): boolean {
    this.transcriptionTexts.push(text);

    // Send webSpeechTranscription
    this.send({
      type: 'webSpeechTranscription',
      payload: {
        text: text,
        timestamp: Date.now(),
        languageCode: this.languageCode
      }
    });

    // Send transcription
    return this.send({
      type: 'transcription',
      payload: {
        text: text,
        role: this.role,
        languageCode: this.languageCode
      }
    });
  }

  public register(role: UserRole, languageCode: string): boolean {
    // Special handling for teacher role
    if (role === 'teacher') {
      this.role = 'teacher';
      this.roleLocked = true;
    } 
    // Only allow role to be changed if it's not locked
    else if (!this.roleLocked && this.role !== role) {
      this.role = role;
    }

    // Always update language if different
    if (this.languageCode !== languageCode) {
      this.languageCode = languageCode;
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

  public addEventListener(eventType: string, callback: (data: any) => void): void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, []);
    }
    
    this.listeners.get(eventType)?.push(callback);
  }

  public removeEventListener(eventType: string, callback: (data: any) => void): void {
    if (!this.listeners.has(eventType)) return;
    
    const callbacks = this.listeners.get(eventType);
    if (callbacks) {
      const index = callbacks.indexOf(callback);
      if (index !== -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  private notifyListeners(eventType: string, data: any): void {
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

  public getSessionId(): string | null {
    return this.sessionId;
  }

  public setRoleAndLock(role: UserRole): boolean {
    this.role = role;
    this.roleLocked = true;
    
    return this.send({
      type: 'register',
      payload: {
        role: this.role,
        languageCode: this.languageCode,
        roleLocked: true
      }
    });
  }

  // Test control methods
  public setConnectionDelay(delay: number): void {
    this.connectionDelay = delay;
  }

  public setFailNextConnection(shouldFail: boolean): void {
    this.shouldFailNextConnection = shouldFail;
  }

  public simulateIncomingMessage(message: any): void {
    this.notifyListeners('message', message);
    
    // Also notify for specific event types
    if (message.type) {
      this.notifyListeners(message.type, message);
    }
  }

  public simulateDisconnect(): void {
    this.status = 'disconnected';
    this.notifyListeners('disconnect', {});
  }

  public simulateReconnect(): void {
    this.status = 'connected';
    this.notifyListeners('connect', { sessionId: this.sessionId });
  }

  public simulateTranslation(sourceLanguage: string, targetLanguage: string, originalText: string, translatedText: string): void {
    this.notifyListeners('translation', {
      type: 'translation',
      payload: {
        sessionId: this.sessionId || 'test_session',
        sourceLanguage,
        targetLanguage,
        originalText,
        translatedText,
        audio: 'base64_encoded_audio_data', // Mock audio data
        timestamp: new Date().toISOString(),
        latency: 150 // Mock latency in ms
      }
    });
  }

  public simulateCurrentSpeech(text: string): void {
    this.notifyListeners('current_speech', {
      type: 'current_speech',
      text,
      timestamp: Date.now()
    });
  }

  public simulateError(errorMessage: string): void {
    this.notifyListeners('error', {
      type: 'error',
      error: errorMessage
    });
  }

  // Test assertion helpers
  public getLastSentMessage(): WebSocketMessage | null {
    return this.lastSentMessage;
  }

  public getMessageHistory(): WebSocketMessage[] {
    return this.sentMessages;
  }

  public getAudioHistory(): string[] {
    return this.audioData;
  }

  public getTranscriptionHistory(): string[] {
    return this.transcriptionTexts;
  }
}