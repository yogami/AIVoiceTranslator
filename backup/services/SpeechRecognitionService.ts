/**
 * Speech Recognition Service
 * 
 * Uses Web Speech API to provide speech-to-text functionality
 */

// Add type definitions for the Web Speech API
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

// Speech Recognition Result interface
export interface SpeechRecognitionResult {
  text: string;
  isFinal: boolean;
  language: string;
  confidence?: number;
}

/**
 * Service for handling speech recognition using the Web Speech API
 */
export class SpeechRecognitionService {
  private recognition: SpeechRecognition | null = null;
  private isRecording: boolean = false;
  private language: string = 'en-US';
  private listeners: Map<string, Function[]> = new Map();
  
  constructor() {
    // Check if speech recognition is supported and create an instance
    if (this.isSupported()) {
      this.initialize();
    }
  }
  
  /**
   * Check if Web Speech API is supported in this browser
   */
  public isSupported(): boolean {
    return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  }
  
  /**
   * Initialize the speech recognition service
   */
  private initialize(): void {
    // Use the appropriate constructor based on browser support
    const SpeechRecognitionConstructor = window.SpeechRecognition || window.webkitSpeechRecognition;
    this.recognition = new SpeechRecognitionConstructor();
    
    if (this.recognition) {
      // Configure initial settings
      this.recognition.continuous = true;
      this.recognition.interimResults = true;
      this.recognition.lang = this.language;
      this.recognition.maxAlternatives = 1;
      
      // Set up event handlers
      this.setupEventHandlers();
    }
  }
  
  /**
   * Set up event handlers for the speech recognition instance
   */
  private setupEventHandlers(): void {
    if (!this.recognition) return;
    
    this.recognition.onstart = () => {
      this.isRecording = true;
      this.emit('start');
    };
    
    this.recognition.onend = () => {
      this.isRecording = false;
      this.emit('end');
    };
    
    this.recognition.onresult = (event) => {
      const result = this.processRecognitionResult(event);
      if (result) {
        this.emit('result', result);
      }
    };
    
    this.recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      this.emit('error', new Error(event.error));
    };
  }
  
  /**
   * Process the raw recognition result into our standardized format
   */
  private processRecognitionResult(event: SpeechRecognitionEvent): SpeechRecognitionResult | null {
    if (event.results.length === 0) {
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
      confidence: result[0].confidence
    };
  }
  
  /**
   * Start speech recognition
   */
  public async start(): Promise<boolean> {
    if (this.isRecording) {
      return true; // Already recording
    }
    
    if (!this.isSupported()) {
      this.emit('error', new Error('SpeechRecognition is not supported'));
      return false;
    }
    
    if (!this.recognition) {
      this.initialize();
    }
    
    try {
      this.recognition!.start();
      return true;
    } catch (error) {
      console.error('Failed to start speech recognition:', error);
      this.emit('error', error instanceof Error ? error : new Error(String(error)));
      return false;
    }
  }
  
  /**
   * Stop speech recognition
   */
  public stop(): boolean {
    if (!this.isRecording || !this.recognition) {
      return false;
    }
    
    try {
      this.recognition.stop();
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
      this.isRecording = false;
      return true;
    } catch (error) {
      console.error('Failed to abort speech recognition:', error);
      return false;
    }
  }
  
  /**
   * Check if currently recording
   */
  public isActive(): boolean {
    return this.isRecording;
  }
  
  /**
   * Set the recognition language
   */
  public setLanguage(language: string): void {
    this.language = language;
    
    if (this.recognition) {
      this.recognition.lang = language;
    }
  }
  
  /**
   * Get the current language
   */
  public getLanguage(): string {
    return this.language;
  }
  
  /**
   * Register an event listener
   */
  public on(event: string, callback: Function): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    
    this.listeners.get(event)!.push(callback);
  }
  
  /**
   * Remove an event listener
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