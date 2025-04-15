/**
 * Basic result of a transcription operation
 */
export interface TranscriptionResult {
  text: string;
  isFinal: boolean;
  confidence?: number;
  languageCode?: string;
}

/**
 * Possible error types in transcription
 */
export type TranscriptionErrorType = 
  | 'permission_denied'
  | 'network_error' 
  | 'not_supported'
  | 'unknown';

/**
 * Error object for transcription errors
 */
export interface TranscriptionError {
  type: TranscriptionErrorType;
  message: string;
  original?: Error;
}

/**
 * Options for configuring transcription services
 */
export interface TranscriptionOptions {
  language?: string;
  continuous?: boolean;
  interimResults?: boolean;
  role?: 'teacher' | 'student';
}

/**
 * Listeners for transcription events
 */
export interface TranscriptionListeners {
  onTranscriptionResult?: (result: TranscriptionResult) => void;
  onTranscriptionError?: (error: TranscriptionError) => void;
  onTranscriptionStart?: () => void;
  onTranscriptionEnd?: () => void;
}

/**
 * Common interface for all transcription services
 */
export interface TranscriptionService {
  /**
   * Check if this service is supported in the current environment
   */
  isSupported(): boolean;
  
  /**
   * Start the transcription process
   */
  start(): boolean | Promise<boolean>;
  
  /**
   * Stop the transcription process
   */
  stop(): boolean;
  
  /**
   * Abort transcription and clean up all resources
   */
  abort(): boolean;
  
  /**
   * Check if transcription is active
   */
  isActive(): boolean;
  
  /**
   * Update transcription options
   */
  updateOptions(options: TranscriptionOptions): void;
  
  /**
   * Update event listeners
   */
  updateListeners(listeners: TranscriptionListeners): void;
}