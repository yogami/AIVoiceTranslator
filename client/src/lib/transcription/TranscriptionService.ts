/**
 * Represents the possible states of a transcription service
 */
export type TranscriptionState = 'inactive' | 'recording' | 'paused' | 'error';

/**
 * Represents a transcription result from the speech recognition service
 */
export interface TranscriptionResult {
  /** The transcribed text */
  text: string;
  
  /** Whether this is a final result or an interim result that might change */
  isFinal: boolean;
  
  /** Language code for the transcription */
  language: string;
  
  /** Confidence score of the transcription (0-1) */
  confidence?: number;
}

/**
 * Abstract interface for any transcription service implementation
 * This provides a common API for different transcription services (Web Speech API, OpenAI, etc.)
 */
export interface TranscriptionService {
  /**
   * Check if this transcription service is supported in the current environment
   * @returns true if supported, false otherwise
   */
  isSupported(): boolean;
  
  /**
   * Start the transcription service
   * @returns Promise that resolves to true if started successfully, false otherwise
   */
  start(): Promise<boolean>;
  
  /**
   * Stop the transcription service
   * @returns true if stopped successfully, false otherwise
   */
  stop(): boolean;
  
  /**
   * Emergency stop of transcription service
   * @returns true if aborted successfully, false otherwise
   */
  abort(): boolean;
  
  /**
   * Get the current state of the transcription service
   * @returns The current state
   */
  getState(): TranscriptionState;
  
  /**
   * Set the language for transcription
   * @param language The language code (e.g., 'en-US', 'es-ES')
   */
  setLanguage(language: string): void;
  
  /**
   * Get the current language setting
   * @returns The current language code
   */
  getLanguage(): string;
  
  /**
   * Check if the service is currently active (recording)
   * @returns true if active, false otherwise
   */
  isActive(): boolean;
  
  /**
   * Update options for the transcription service
   * @param options Options object with configuration settings
   */
  updateOptions(options: any): void;
  
  /**
   * Register an event listener
   * @param event The event name (start, stop, result, finalResult, error, etc.)
   * @param callback The function to call when the event occurs
   */
  on(event: string, callback: Function): void;
  
  /**
   * Remove an event listener
   * @param event The event name
   * @param callback The function to remove
   */
  off(event: string, callback: Function): void;
  
  /**
   * Update all event listeners (used after recreating internal resources)
   */
  updateListeners(): void;
}