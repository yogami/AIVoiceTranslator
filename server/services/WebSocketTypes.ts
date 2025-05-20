/**
 * WebSocket Types
 * 
 * Shared types for WebSocket implementation
 */

/**
 * Extended WebSocket client with additional properties
 */
export type WebSocketClient = WebSocket & {
  isAlive: boolean;
  sessionId: string;
  on: (event: string, listener: (...args: any[]) => void) => WebSocketClient;
  terminate: () => void;
  ping: () => void;
  send: (data: string) => void;
}

/**
 * Generic WebSocket message interface
 */
export interface WebSocketMessage {
  type: string;
  [key: string]: any;
}

/**
 * Register message interface
 */
export interface RegisterMessage extends WebSocketMessage {
  type: 'register';
  role?: string;
  languageCode?: string;
  settings?: {
    ttsServiceType?: string;
    [key: string]: any;
  };
}

/**
 * Transcription message interface
 */
export interface TranscriptionMessage extends WebSocketMessage {
  type: 'transcription';
  text: string;
  timestamp?: number;
}

/**
 * TTS Request message interface
 */
export interface TTSRequestMessage extends WebSocketMessage {
  type: 'tts_request';
  text: string;
  languageCode: string;
  voice?: string;
}

/**
 * Audio message interface
 */
export interface AudioMessage extends WebSocketMessage {
  type: 'audio';
  data: string; // Base64-encoded audio data
}

/**
 * Settings message interface
 */
export interface SettingsMessage extends WebSocketMessage {
  type: 'settings';
  ttsServiceType?: string;
  settings?: {
    [key: string]: any;
  };
}

/**
 * Ping message interface
 */
export interface PingMessage extends WebSocketMessage {
  type: 'ping';
  timestamp: number;
}

/**
 * Translation result interface matching the TranslationService output
 */
export interface TranslationResult {
  originalText: string;
  translatedText: string;
  audioBuffer: Buffer;
}