import { TranscriptionService, TranscriptionState, TranscriptionResult } from './TranscriptionService';

/**
 * Implementation of the TranscriptionService using the Web Speech API
 */
export class WebSpeechTranscriptionService implements TranscriptionService {
  private recognition: SpeechRecognition | null = null;
  private state: TranscriptionState = 'inactive';
  private language: string = 'en-US';
  private listeners: Map<string, Function[]> = new Map();
  
  constructor() {
    // Check if recognition is supported and create an instance
    if (this.isSupported()) {
      this.initializeRecognition();
    } else {
      console.warn('SpeechRecognition is not supported in this browser');
    }
  }
  
  /**
   * Check if Web Speech API is supported in this browser
   */
  public isSupported(): boolean {
    return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  }
  
  /**
   * Create and initialize the SpeechRecognition instance
   */
  private initializeRecognition(): void {
    // Use the appropriate constructor (standard or webkit)
    const SpeechRecognitionConstructor = window.SpeechRecognition || window.webkitSpeechRecognition;
    this.recognition = new SpeechRecognitionConstructor();
    
    if (this.recognition) {
      // Configure the recognition
      this.recognition.continuous = true;
      this.recognition.interimResults = true;
      this.recognition.lang = this.language;
      this.recognition.maxAlternatives = 1;
      
      // Set up event handlers
      this.setupEventHandlers();
    }
  }
  
  /**
   * Set up event handlers for the SpeechRecognition instance
   */
  private setupEventHandlers(): void {
    if (!this.recognition) return;
    
    this.recognition.onstart = () => {
      this.state = 'recording';
      this.emit('start');
    };
    
    this.recognition.onend = () => {
      if (this.state === 'recording') {
        this.state = 'inactive';
      }
      this.emit('stop');
    };
    
    this.recognition.onresult = (event) => {
      const result = this.processRecognitionResult(event);
      if (result) {
        this.emit('result', result);
        
        if (result.isFinal) {
          this.emit('finalResult', result);
        }
      }
    };
    
    this.recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      this.state = 'error';
      this.emit('error', new Error(event.error));
    };
    
    this.recognition.onspeechstart = () => this.emit('speechStart');
    this.recognition.onspeechend = () => this.emit('speechEnd');
    this.recognition.onaudiostart = () => this.emit('audioStart');
    this.recognition.onaudioend = () => this.emit('audioEnd');
    this.recognition.onnomatch = () => this.emit('noMatch');
    this.recognition.onsoundstart = () => this.emit('soundStart');
    this.recognition.onsoundend = () => this.emit('soundEnd');
  }
  
  /**
   * Process the raw recognition result into our standardized format
   */
  private processRecognitionResult(event: SpeechRecognitionEvent): TranscriptionResult | null {
    if (event.results.length === 0 || event.resultIndex >= event.results.length) {
      return null;
    }
    
    const result = event.results[event.resultIndex];
    if (result.length === 0) {
      return null;
    }
    
    const text = result[0].transcript.trim();
    const isFinal = result.isFinal === true;
    
    return {
      text,
      isFinal,
      language: this.language,
      confidence: result[0].confidence || 0
    };
  }
  
  /**
   * Start speech recognition
   */
  public async start(): Promise<boolean> {
    if (this.state === 'recording') {
      // Already recording
      return true;
    }
    
    if (!this.isSupported()) {
      this.state = 'error';
      this.emit('error', new Error('SpeechRecognition is not supported'));
      return false;
    }
    
    if (!this.recognition) {
      this.initializeRecognition();
    }
    
    try {
      this.state = 'recording';
      this.recognition!.start();
      return true;
    } catch (error) {
      console.error('Failed to start speech recognition:', error);
      this.state = 'error';
      this.emit('error', error instanceof Error ? error : new Error(String(error)));
      return false;
    }
  }
  
  /**
   * Stop speech recognition
   */
  public stop(): boolean {
    if (this.state !== 'recording' || !this.recognition) {
      return false;
    }
    
    try {
      this.recognition.stop();
      this.state = 'inactive';
      return true;
    } catch (error) {
      console.error('Failed to stop speech recognition:', error);
      return false;
    }
  }
  
  /**
   * Abort speech recognition (emergency stop)
   */
  public abort(): boolean {
    if (!this.recognition) {
      return false;
    }
    
    try {
      this.recognition.abort();
      this.state = 'inactive';
      return true;
    } catch (error) {
      console.error('Failed to abort speech recognition:', error);
      return false;
    }
  }
  
  /**
   * Get the current state of the service
   */
  public getState(): TranscriptionState {
    return this.state;
  }
  
  /**
   * Set the language for recognition
   */
  public setLanguage(language: string): void {
    this.language = language;
    
    if (this.recognition) {
      this.recognition.lang = language;
    }
  }
  
  /**
   * Get the current language setting
   */
  public getLanguage(): string {
    return this.language;
  }
  
  /**
   * Helper method to check if the service is currently active
   */
  public isActive(): boolean {
    return this.state === 'recording';
  }
  
  /**
   * Update recognition options
   * @param options Options to update
   */
  public updateOptions(options: {
    continuous?: boolean;
    interimResults?: boolean;
    maxAlternatives?: number;
  }): void {
    if (!this.recognition) return;
    
    if (options.continuous !== undefined) {
      this.recognition.continuous = options.continuous;
    }
    
    if (options.interimResults !== undefined) {
      this.recognition.interimResults = options.interimResults;
    }
    
    if (options.maxAlternatives !== undefined) {
      this.recognition.maxAlternatives = options.maxAlternatives;
    }
  }
  
  /**
   * Register event listener
   */
  public on(event: string, callback: Function): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    
    this.listeners.get(event)!.push(callback);
  }
  
  /**
   * Remove event listener
   */
  public off(event: string, callback: Function): void {
    if (!this.listeners.has(event)) return;
    
    const callbacks = this.listeners.get(event)!;
    const index = callbacks.indexOf(callback);
    
    if (index !== -1) {
      callbacks.splice(index, 1);
    }
  }
  
  /**
   * Update all event listeners (used when recreating the recognition instance)
   */
  public updateListeners(): void {
    if (this.recognition) {
      this.setupEventHandlers();
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