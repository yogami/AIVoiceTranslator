import { 
  TranscriptionService, 
  TranscriptionOptions, 
  TranscriptionListeners,
  TranscriptionResult,
  TranscriptionError
} from './TranscriptionService';

// Type definitions for the Web Speech API
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message: string;
}

// Override Window interface to include Web Speech API
declare global {
  interface Window {
    SpeechRecognition: typeof SpeechRecognition;
    webkitSpeechRecognition: typeof SpeechRecognition;
    mozSpeechRecognition: typeof SpeechRecognition;
    msSpeechRecognition: typeof SpeechRecognition;
  }
}

/**
 * Implementation of TranscriptionService using browser's Web Speech API
 */
export class WebSpeechTranscriptionService implements TranscriptionService {
  private recognition: any = null;
  private isListening: boolean = false;
  private options: TranscriptionOptions = {
    language: 'en-US',
    continuous: true,
    interimResults: true
  };
  private listeners: TranscriptionListeners = {};

  constructor(options?: TranscriptionOptions, listeners?: TranscriptionListeners) {
    // Set initial options
    if (options) {
      this.options = { ...this.options, ...options };
    }
    
    // Set initial listeners
    if (listeners) {
      this.listeners = { ...this.listeners, ...listeners };
    }
    
    // Initialize if the browser supports it
    if (this.isSupported()) {
      this.initializeRecognition();
    }
  }

  public isSupported(): boolean {
    return !!(
      typeof window !== 'undefined' && (
        window.SpeechRecognition || 
        window.webkitSpeechRecognition || 
        window.mozSpeechRecognition || 
        window.msSpeechRecognition
      )
    );
  }

  private initializeRecognition(): void {
    // Get the appropriate SpeechRecognition constructor
    const SpeechRecognition = 
      window.SpeechRecognition || 
      window.webkitSpeechRecognition || 
      window.mozSpeechRecognition || 
      window.msSpeechRecognition;

    if (!SpeechRecognition) {
      this.handleError({
        type: 'not_supported',
        message: 'SpeechRecognition is not supported in this browser'
      });
      return;
    }

    // Create a new instance
    this.recognition = new SpeechRecognition();

    // Configure the recognition object
    this.applyOptions();
    
    // Set up event handlers
    this.setupEventHandlers();
  }

  private applyOptions(): void {
    if (!this.recognition) return;
    
    this.recognition.lang = this.options.language || 'en-US';
    this.recognition.continuous = this.options.continuous !== undefined ? this.options.continuous : true;
    this.recognition.interimResults = this.options.interimResults !== undefined ? this.options.interimResults : true;
  }

  private setupEventHandlers(): void {
    if (!this.recognition) return;
    
    this.recognition.onstart = () => {
      this.isListening = true;
      console.log('Web Speech API: Recognition started');
      
      if (this.listeners.onTranscriptionStart) {
        this.listeners.onTranscriptionStart();
      }
    };

    this.recognition.onend = () => {
      this.isListening = false;
      console.log('Web Speech API: Recognition ended');
      
      if (this.listeners.onTranscriptionEnd) {
        this.listeners.onTranscriptionEnd();
      }
      
      // Auto-restart if continuous mode is enabled and no error occurred
      if (this.options.continuous && !this.isListening) {
        setTimeout(() => {
          if (this.options.continuous && !this.isListening) {
            this.start();
          }
        }, 300);
      }
    };

    this.recognition.onresult = (event: SpeechRecognitionEvent) => {
      let finalTranscript = '';
      let interimTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        const confidence = event.results[i][0].confidence;
        
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }

      const text = finalTranscript || interimTranscript;
      const isFinal = !!finalTranscript;

      console.log(`Web Speech API: Result - ${text} (${isFinal ? 'final' : 'interim'})`);
      
      if (this.listeners.onTranscriptionResult && text) {
        this.listeners.onTranscriptionResult({
          text,
          isFinal,
          confidence: event.results[0]?.[0]?.confidence,
          languageCode: this.options.language
        });
      }
    };

    this.recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error('Web Speech API error:', event.error, event.message);
      
      let errorType: TranscriptionErrorType = 'unknown';
      
      // Map the Web Speech API error types to our error types
      switch (event.error) {
        case 'not-allowed':
        case 'service-not-allowed':
          errorType = 'permission_denied';
          break;
        case 'network':
          errorType = 'network_error';
          break;
        case 'no-speech':
        case 'audio-capture':
        case 'language-not-supported':
        default:
          errorType = 'unknown';
      }
      
      this.handleError({
        type: errorType,
        message: `Speech recognition error: ${event.error}`,
        original: new Error(event.message)
      });
    };
  }

  private handleError(error: TranscriptionError): void {
    if (this.listeners.onTranscriptionError) {
      this.listeners.onTranscriptionError(error);
    }
  }

  public start(): boolean {
    if (!this.recognition) {
      if (this.isSupported()) {
        this.initializeRecognition();
      } else {
        this.handleError({
          type: 'not_supported',
          message: 'Speech recognition is not supported in this environment'
        });
        return false;
      }
    }

    if (this.isListening) {
      console.warn('Web Speech API: Already listening');
      return true;
    }

    try {
      console.log('Web Speech API: Starting recognition');
      this.recognition.start();
      return true;
    } catch (error) {
      console.error('Web Speech API: Error starting recognition:', error);
      this.handleError({
        type: 'unknown',
        message: 'Failed to start speech recognition',
        original: error as Error
      });
      return false;
    }
  }

  public stop(): boolean {
    if (!this.recognition) {
      console.warn('Web Speech API: Recognition not initialized');
      return false;
    }

    if (!this.isListening) {
      console.warn('Web Speech API: Not currently listening');
      return true;
    }

    try {
      console.log('Web Speech API: Stopping recognition');
      this.recognition.stop();
      return true;
    } catch (error) {
      console.error('Web Speech API: Error stopping recognition:', error);
      this.handleError({
        type: 'unknown',
        message: 'Failed to stop speech recognition',
        original: error as Error
      });
      return false;
    }
  }

  public abort(): boolean {
    if (!this.recognition) {
      console.warn('Web Speech API: Recognition not initialized');
      return false;
    }

    try {
      console.log('Web Speech API: Aborting recognition');
      this.recognition.abort();
      return true;
    } catch (error) {
      console.error('Web Speech API: Error aborting recognition:', error);
      this.handleError({
        type: 'unknown',
        message: 'Failed to abort speech recognition',
        original: error as Error
      });
      return false;
    }
  }

  public isActive(): boolean {
    return this.isListening;
  }

  public updateOptions(options: TranscriptionOptions): void {
    const prevOptions = { ...this.options };
    this.options = { ...this.options, ...options };
    
    // Check if critical parameters changed that require restart
    const needsRestart = this.isListening && (
      prevOptions.language !== this.options.language ||
      prevOptions.continuous !== this.options.continuous ||
      prevOptions.interimResults !== this.options.interimResults
    );
    
    // Apply options to recognition object if it exists
    if (this.recognition) {
      this.applyOptions();
      
      // Restart if needed
      if (needsRestart) {
        console.log('Web Speech API: Restarting due to option changes');
        this.stop();
        setTimeout(() => this.start(), 200);
      }
    }
  }

  public updateListeners(listeners: TranscriptionListeners): void {
    this.listeners = { ...this.listeners, ...listeners };
  }
}

// Singleton instance for easy access
let instance: WebSpeechTranscriptionService | null = null;

export function getWebSpeechTranscriptionService(
  options?: TranscriptionOptions, 
  listeners?: TranscriptionListeners
): WebSpeechTranscriptionService {
  if (!instance) {
    instance = new WebSpeechTranscriptionService(options, listeners);
  } else {
    if (options) {
      instance.updateOptions(options);
    }
    if (listeners) {
      instance.updateListeners(listeners);
    }
  }
  
  return instance;
}