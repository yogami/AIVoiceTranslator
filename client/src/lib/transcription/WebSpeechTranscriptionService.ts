import { TranscriptionService, TranscriptionState, TranscriptionResult } from './TranscriptionService';

/**
 * Options that can be passed to configure the Web Speech API based transcription service
 */
export interface WebSpeechOptions {
  continuous?: boolean;
  interimResults?: boolean;
  maxAlternatives?: number;
  language?: string;
}

/**
 * Type for event listener map
 */
export type EventListenerMap = Record<string, Function[]>;

/**
 * Factory function to create a new Web Speech API transcription service
 * 
 * @param options Configuration options for the speech recognition
 * @param listeners Initial event listeners to register
 * @returns A new WebSpeechTranscriptionService instance
 */
export function getWebSpeechTranscriptionService(
  options?: WebSpeechOptions,
  listeners?: EventListenerMap
): WebSpeechTranscriptionService {
  const service = new WebSpeechTranscriptionService();
  
  // Apply options if provided
  if (options) {
    if (options.language) {
      service.setLanguage(options.language);
    }
    
    const recognitionOptions: Record<string, any> = {};
    if (options.continuous !== undefined) {
      recognitionOptions.continuous = options.continuous;
    }
    if (options.interimResults !== undefined) {
      recognitionOptions.interimResults = options.interimResults;
    }
    if (options.maxAlternatives !== undefined) {
      recognitionOptions.maxAlternatives = options.maxAlternatives;
    }
    
    service.updateOptions(recognitionOptions);
  }
  
  // Register initial listeners if provided
  if (listeners) {
    Object.entries(listeners).forEach(([event, callbackList]) => {
      callbackList.forEach(callback => {
        service.on(event, callback);
      });
    });
  }
  
  return service;
}

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
    const supported = !!(window.SpeechRecognition || window.webkitSpeechRecognition);
    console.log('[WebSpeechTranscriptionService] SpeechRecognition API supported:', supported);
    return supported;
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
    if (!this.recognition) {
      console.error('[WebSpeechTranscriptionService] Cannot setup event handlers: recognition instance is null');
      return;
    }
    
    this.recognition.onstart = () => {
      console.log('[WebSpeechTranscriptionService] Recognition started');
      this.state = 'recording';
      this.emit('start');
    };
    
    this.recognition.onend = () => {
      console.log('[WebSpeechTranscriptionService] Recognition ended');
      if (this.state === 'recording') {
        this.state = 'inactive';
      }
      this.emit('stop');
      
      // Auto restart if it ended unexpectedly while we still think we're recording
      if (this.state === 'recording') {
        console.log('[WebSpeechTranscriptionService] Recognition ended unexpectedly, restarting...');
        try {
          this.recognition!.start();
        } catch (error) {
          console.error('[WebSpeechTranscriptionService] Failed to restart recognition:', error);
        }
      }
    };
    
    this.recognition.onresult = (event) => {
      console.log('[WebSpeechTranscriptionService] Recognition result received', event);
      const result = this.processRecognitionResult(event);
      if (result) {
        console.log('[WebSpeechTranscriptionService] Processed result:', result);
        this.emit('result', result);
        
        if (result.isFinal) {
          console.log('[WebSpeechTranscriptionService] Final result:', result.text);
          this.emit('finalResult', result);
        }
      } else {
        console.warn('[WebSpeechTranscriptionService] Could not process recognition result');
      }
    };
    
    this.recognition.onerror = (event) => {
      console.error('[WebSpeechTranscriptionService] Recognition error:', event.error);
      
      // Don't set state to error for 'no-speech' error as it's common and not critical
      if (event.error !== 'no-speech') {
        this.state = 'error';
      }
      
      // If we get 'aborted' error but we think we're still recording, restart
      if (event.error === 'aborted' && this.state === 'recording') {
        console.log('[WebSpeechTranscriptionService] Recognition was aborted, attempting to restart...');
        try {
          this.recognition!.start();
        } catch (restartError) {
          console.error('[WebSpeechTranscriptionService] Failed to restart after abort:', restartError);
        }
      }
      
      this.emit('error', new Error(event.error));
    };
    
    this.recognition.onspeechstart = () => {
      console.log('[WebSpeechTranscriptionService] Speech started');
      this.emit('speechStart');
    };
    
    this.recognition.onspeechend = () => {
      console.log('[WebSpeechTranscriptionService] Speech ended');
      this.emit('speechEnd');
    };
    
    this.recognition.onaudiostart = () => {
      console.log('[WebSpeechTranscriptionService] Audio capture started');
      this.emit('audioStart');
    };
    
    this.recognition.onaudioend = () => {
      console.log('[WebSpeechTranscriptionService] Audio capture ended');
      this.emit('audioEnd');
    };
    
    this.recognition.onnomatch = () => {
      console.log('[WebSpeechTranscriptionService] No match found');
      this.emit('noMatch');
    };
    
    this.recognition.onsoundstart = () => {
      console.log('[WebSpeechTranscriptionService] Sound detected');
      this.emit('soundStart');
    };
    
    this.recognition.onsoundend = () => {
      console.log('[WebSpeechTranscriptionService] Sound ended');
      this.emit('soundEnd');
    };
  }
  
  /**
   * Process the raw recognition result into our standardized format
   */
  private processRecognitionResult(event: SpeechRecognitionEvent): TranscriptionResult | null {
    try {
      console.log('[WebSpeechTranscriptionService] Processing recognition result', {
        resultsLength: event.results.length,
        resultIndex: event.resultIndex
      });
      
      // First check if we have results at all
      if (event.results.length === 0) {
        console.warn('[WebSpeechTranscriptionService] No results in event');
        return null;
      }
      
      // Chrome and Firefox handle results differently
      // Chrome has a resultIndex property that points to the current result
      // Firefox sometimes doesn't have this, so we need to handle both cases
      let transcript = '';
      let isFinal = false;
      let confidence = 0;
      
      if (event.resultIndex !== undefined && event.resultIndex < event.results.length) {
        // Chrome-style: Use the result at resultIndex
        const result = event.results[event.resultIndex];
        if (result.length > 0) {
          transcript = result[0].transcript.trim();
          isFinal = result.isFinal === true;
          confidence = result[0].confidence || 0;
        }
      } else {
        // Firefox-style or fallback: Concatenate all final results
        // And use the last non-final one (if any)
        let finalText = '';
        let interimText = '';
        
        for (let i = 0; i < event.results.length; i++) {
          const result = event.results[i];
          if (result.length > 0) {
            if (result.isFinal) {
              finalText += result[0].transcript + ' ';
            } else {
              // Only keep the latest interim result
              interimText = result[0].transcript;
            }
          }
        }
        
        // Use the combined final text, or the latest interim if no final
        transcript = finalText.trim();
        if (transcript) {
          isFinal = true;
          confidence = 0.9; // Arbitrary high confidence for final text
        } else {
          transcript = interimText.trim();
          isFinal = false;
          confidence = 0.5; // Arbitrary medium confidence for interim text
        }
      }
      
      if (!transcript) {
        console.warn('[WebSpeechTranscriptionService] No transcript extracted from results');
        return null;
      }
      
      console.log('[WebSpeechTranscriptionService] Extracted transcript:', {
        text: transcript,
        isFinal,
        confidence
      });
      
      return {
        text: transcript,
        isFinal,
        language: this.language,
        confidence
      };
    } catch (error) {
      console.error('[WebSpeechTranscriptionService] Error processing recognition result:', error);
      return null;
    }
  }
  
  /**
   * Start speech recognition
   */
  public async start(): Promise<boolean> {
    if (this.state === 'recording') {
      console.log('[WebSpeechTranscriptionService] Already recording, no need to start');
      return true;
    }
    
    if (!this.isSupported()) {
      this.state = 'error';
      const errorMsg = 'SpeechRecognition is not supported in this browser';
      console.error(`[WebSpeechTranscriptionService] ${errorMsg}`);
      this.emit('error', new Error(errorMsg));
      return false;
    }
    
    if (!this.recognition) {
      console.log('[WebSpeechTranscriptionService] Creating new recognition instance');
      this.initializeRecognition();
    }
    
    try {
      // Request microphone permission first
      console.log('[WebSpeechTranscriptionService] Requesting microphone permission...');
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        // Stop the stream right away, we just needed to prompt for permission
        stream.getTracks().forEach(track => track.stop());
        console.log('[WebSpeechTranscriptionService] Microphone permission granted');
      } catch (permissionError) {
        console.error('[WebSpeechTranscriptionService] Microphone permission denied:', permissionError);
        this.emit('error', new Error('Microphone permission denied. Please allow microphone access.'));
        this.state = 'error';
        return false;
      }
      
      // Now start speech recognition
      console.log('[WebSpeechTranscriptionService] Starting speech recognition...');
      this.state = 'recording';
      this.recognition!.start();
      console.log('[WebSpeechTranscriptionService] Speech recognition started successfully');
      return true;
    } catch (error) {
      console.error('[WebSpeechTranscriptionService] Failed to start speech recognition:', error);
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