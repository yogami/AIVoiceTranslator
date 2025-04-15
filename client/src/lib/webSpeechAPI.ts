// Web Speech API implementation for real-time speech recognition

// Export our simplified result type for consumers
export interface SpeechRecognitionResult {
  isFinal: boolean;
  text: string;
}

export interface SpeechRecognitionOptions {
  language?: string;
  continuous?: boolean;
  interimResults?: boolean;
  onResult?: (result: SpeechRecognitionResult) => void;
  onError?: (error: Error) => void;
  onStart?: () => void;
  onEnd?: () => void;
}

// Type definitions for the Web Speech API (internal use)
// These are the official browser API types
interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface WebSpeechRecognitionResult {
  isFinal: boolean;
  [index: number]: SpeechRecognitionAlternative;
  length: number;
}

interface SpeechRecognitionEvent extends Event {
  results: {
    [index: number]: WebSpeechRecognitionResult;
    length: number;
    item(index: number): WebSpeechRecognitionResult;
  };
  resultIndex: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message: string;
}

// Define the class that will handle speech recognition
export class WebSpeechRecognition {
  private recognition: any = null;
  private isListening: boolean = false;
  private language: string = 'en-US';
  private continuous: boolean = true;
  private interimResults: boolean = true;
  private onResult: ((result: SpeechRecognitionResult) => void) | null = null;
  private onError: ((error: Error) => void) | null = null;
  private onStart: (() => void) | null = null;
  private onEnd: (() => void) | null = null;

  constructor(options: SpeechRecognitionOptions = {}) {
    // Check if the Web Speech API is supported
    if (!this.isSupported()) {
      console.error('Web Speech API is not supported in this browser');
      return;
    }

    // Set options
    this.language = options.language || 'en-US';
    this.continuous = options.continuous !== undefined ? options.continuous : true;
    this.interimResults = options.interimResults !== undefined ? options.interimResults : true;
    this.onResult = options.onResult || null;
    this.onError = options.onError || null;
    this.onStart = options.onStart || null;
    this.onEnd = options.onEnd || null;

    // Initialize the recognition object
    this.initializeRecognition();
  }

  // Check if Web Speech API is supported
  public isSupported(): boolean {
    return !!(window.SpeechRecognition || 
             window.webkitSpeechRecognition || 
             window.mozSpeechRecognition || 
             window.msSpeechRecognition);
  }

  // Initialize the recognition object
  private initializeRecognition(): void {
    // Get the appropriate SpeechRecognition constructor
    const SpeechRecognition = window.SpeechRecognition || 
                             window.webkitSpeechRecognition || 
                             window.mozSpeechRecognition || 
                             window.msSpeechRecognition;

    if (!SpeechRecognition) {
      console.error('SpeechRecognition is not supported');
      return;
    }

    // Create a new instance
    this.recognition = new SpeechRecognition();

    // Configure the recognition object
    this.recognition.lang = this.language;
    this.recognition.continuous = this.continuous;
    this.recognition.interimResults = this.interimResults;

    // Set up event handlers
    this.recognition.onstart = () => {
      this.isListening = true;
      console.log('Speech recognition started');
      if (this.onStart) this.onStart();
    };

    this.recognition.onend = () => {
      this.isListening = false;
      console.log('Speech recognition ended');
      if (this.onEnd) this.onEnd();
    };

    this.recognition.onresult = (event: SpeechRecognitionEvent) => {
      let finalTranscript = '';
      let interimTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        // Properly access the transcript with appropriate type handling
        const result = event.results[i];
        const firstAlternative = result[0] || { transcript: '' };
        const transcript = firstAlternative.transcript || '';
        
        if (result.isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }

      const text = finalTranscript || interimTranscript;
      const isFinal = !!finalTranscript;

      console.log(`Speech recognition result: ${text} (${isFinal ? 'final' : 'interim'})`);
      
      if (this.onResult && text) {
        this.onResult({ 
          text, 
          isFinal 
        });
      }
    };

    this.recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error('Speech recognition error:', event.error, event.message);
      if (this.onError) {
        this.onError(new Error(`Speech recognition error: ${event.error}`));
      }
    };
  }

  // Start speech recognition
  public start(): boolean {
    if (!this.recognition) {
      console.error('Recognition not initialized');
      return false;
    }

    if (this.isListening) {
      console.warn('Already listening');
      return true;
    }

    try {
      this.recognition.start();
      return true;
    } catch (error) {
      console.error('Error starting speech recognition:', error);
      if (this.onError) this.onError(error as Error);
      return false;
    }
  }

  // Stop speech recognition
  public stop(): boolean {
    if (!this.recognition) {
      console.error('Recognition not initialized');
      return false;
    }

    if (!this.isListening) {
      console.warn('Not currently listening');
      return true;
    }

    try {
      this.recognition.stop();
      return true;
    } catch (error) {
      console.error('Error stopping speech recognition:', error);
      if (this.onError) this.onError(error as Error);
      return false;
    }
  }

  // Abort speech recognition (immediate stop)
  public abort(): boolean {
    if (!this.recognition) {
      console.error('Recognition not initialized');
      return false;
    }

    try {
      this.recognition.abort();
      return true;
    } catch (error) {
      console.error('Error aborting speech recognition:', error);
      if (this.onError) this.onError(error as Error);
      return false;
    }
  }

  // Update recognition parameters
  public updateParams(options: SpeechRecognitionOptions): void {
    let needsRestart = false;
    
    if (options.language && options.language !== this.language) {
      this.language = options.language;
      if (this.recognition) this.recognition.lang = this.language;
      needsRestart = this.isListening;
    }
    
    if (options.continuous !== undefined && options.continuous !== this.continuous) {
      this.continuous = options.continuous;
      if (this.recognition) this.recognition.continuous = this.continuous;
      needsRestart = this.isListening;
    }
    
    if (options.interimResults !== undefined && options.interimResults !== this.interimResults) {
      this.interimResults = options.interimResults;
      if (this.recognition) this.recognition.interimResults = this.interimResults;
      needsRestart = this.isListening;
    }
    
    if (options.onResult) this.onResult = options.onResult;
    if (options.onError) this.onError = options.onError;
    if (options.onStart) this.onStart = options.onStart;
    if (options.onEnd) this.onEnd = options.onEnd;
    
    // If we changed parameters that require a restart and we're currently listening
    if (needsRestart) {
      this.stop();
      setTimeout(() => this.start(), 100);
    }
  }

  // Check if currently listening
  public isActive(): boolean {
    return this.isListening;
  }
}

// SpeechRecognition interface for properly typing the browser API
interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: (event: SpeechRecognitionEvent) => void;
  onerror: (event: SpeechRecognitionErrorEvent) => void;
  onstart: () => void;
  onend: () => void;
}

// Add type definitions for Window object
declare global {
  interface Window {
    SpeechRecognition: {new(): SpeechRecognition};
    webkitSpeechRecognition: {new(): SpeechRecognition};
    mozSpeechRecognition: {new(): SpeechRecognition};
    msSpeechRecognition: {new(): SpeechRecognition};
  }
}

// Singleton instance for easy access
let instance: WebSpeechRecognition | null = null;

export function getSpeechRecognition(options?: SpeechRecognitionOptions): WebSpeechRecognition | null {
  if (!instance) {
    try {
      instance = new WebSpeechRecognition(options);
    } catch (error) {
      console.error('Failed to create speech recognition instance:', error);
      return null;
    }
  } else if (options) {
    // Update existing instance with new options
    instance.updateParams(options);
  }
  
  return instance;
}