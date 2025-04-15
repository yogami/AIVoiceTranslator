/**
 * TranscriptionService interface - defines the common API for all transcription services
 * 
 * This allows different transcription engines to be swapped in and out easily.
 */

export type TranscriptionResult = {
  text: string;
  isFinal: boolean;
  confidence?: number;
  languageCode?: string;
};

export type TranscriptionErrorType = 
  | 'permission_denied'
  | 'not_supported'
  | 'network_error'
  | 'unknown';

export type TranscriptionError = {
  type: TranscriptionErrorType;
  message: string;
  original?: Error;
};

export interface TranscriptionOptions {
  language?: string;
  continuous?: boolean;
  interimResults?: boolean;
}

export interface TranscriptionListeners {
  onTranscriptionResult?: (result: TranscriptionResult) => void;
  onTranscriptionError?: (error: TranscriptionError) => void;
  onTranscriptionStart?: () => void;
  onTranscriptionEnd?: () => void;
}

export interface TranscriptionService {
  /**
   * Check if this transcription service is supported in the current environment
   */
  isSupported(): boolean;
  
  /**
   * Start transcription
   */
  start(): boolean;
  
  /**
   * Stop transcription
   */
  stop(): boolean;
  
  /**
   * Abort transcription (immediate stop)
   */
  abort(): boolean;
  
  /**
   * Check if currently transcribing
   */
  isActive(): boolean;
  
  /**
   * Update transcription parameters
   */
  updateOptions(options: TranscriptionOptions): void;
  
  /**
   * Update event listeners
   */
  updateListeners(listeners: TranscriptionListeners): void;
}