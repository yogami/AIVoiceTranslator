export interface BaseWebSocketMessage {
  type: string;
  timestamp?: number;
}

export interface ClientSettings {
  ttsServiceType?: string;
  useClientSpeech?: boolean; // Added this line
  // Add other potential client-specific settings here
}

// --- Messages TO Server ---

export interface RegisterMessageToServer extends BaseWebSocketMessage {
  type: 'register';
  role: 'teacher' | 'student';
  languageCode: string;
  name?: string; // Added name property for student identification
  classroomCode?: string; // Added classroomCode property for student registration
  settings?: Partial<ClientSettings>; // Allow partial updates
  ttsServiceType?: string; // Kept for backward compatibility, but settings.ttsServiceType is preferred
}

export interface TranscriptionMessageToServer extends BaseWebSocketMessage {
  type: 'transcription';
  text: string;
  // Future: sequenceNumber?: number;
}

export interface AudioMessageToServer extends BaseWebSocketMessage {
  type: 'audio';
  data: string; // base64 encoded audio
  // Note: May contain embedded JSON from client Web Speech API with transcription hint
}

export interface TTSRequestMessageToServer extends BaseWebSocketMessage {
  type: 'tts_request';
  text: string;
  languageCode: string;
  voice?: string;
}

export interface SettingsMessageToServer extends BaseWebSocketMessage {
  type: 'settings';
  settings?: Partial<ClientSettings>;
  ttsServiceType?: string; // Kept for backward compatibility
}

export interface PingMessageToServer extends BaseWebSocketMessage {
  type: 'ping';
  timestamp: number;
}

// --- Messages FROM Server (to Client) ---

export interface ConnectionMessageToClient extends BaseWebSocketMessage {
  type: 'connection';
  status: 'connected';
  sessionId: string;
  role?: 'teacher' | 'student';
  language?: string;
  classroomCode?: string;
}

export interface ClassroomCodeMessageToClient extends BaseWebSocketMessage {
  type: 'classroom_code';
  code: string;
  sessionId: string;
  expiresAt: number;
}

export interface RegisterResponseToClient extends BaseWebSocketMessage {
  type: 'register';
  status: 'success';
  data: {
    role?: 'teacher' | 'student';
    languageCode?: string;
    settings: ClientSettings;
  };
}

export interface LatencyComponents {
  preparation?: number;
  translation: number;
  tts: number;
  processing: number;
  network?: number; // Calculated client-side
}

export interface TranslationMessageToClient extends BaseWebSocketMessage {
  type: 'translation';
  text: string; // Translated text
  originalText: string;
  sourceLanguage: string;
  targetLanguage: string;
  ttsServiceType: string; // Service used for this specific translation's TTS
  latency: {
    total: number;
    serverCompleteTime: number;
    components: LatencyComponents;
  };
  audioData?: string; // base64 encoded audio
  useClientSpeech?: boolean;
  speechParams?: { // Specific params if client speech is used
    type: 'browser-speech';
    text: string;
    languageCode: string;
    autoPlay: boolean;
    [key: string]: any; // Allow other params if needed
  };
}

export interface TTSResponseMessageToClient extends BaseWebSocketMessage {
  type: 'tts_response';
  status: 'success' | 'error';
  text?: string;
  languageCode?: string;
  ttsServiceType?: string;
  audioData?: string; // base64
  useClientSpeech?: boolean;
  speechParams?: { // Specific params if client speech is used
    type: 'browser-speech';
    text: string;
    languageCode: string;
    autoPlay: boolean;
    [key: string]: any; // Allow other params if needed
  };
  error?: {
    message: string;
    code: string;
  };
  timestamp: number;
}

export interface SettingsResponseToClient extends BaseWebSocketMessage {
  type: 'settings';
  status: 'success';
  settings: ClientSettings;
}

export interface PongMessageToClient extends BaseWebSocketMessage {
  type: 'pong';
  timestamp: number;
  originalTimestamp: number;
}

export interface ErrorMessageToClient extends BaseWebSocketMessage {
  type: 'error';
  message: string;
  code?: string;
}

export interface StudentJoinedMessageToClient extends BaseWebSocketMessage {
  type: 'student_joined';
  payload: {
    studentId: string;
    name: string;
    languageCode: string;
  };
}

export interface SessionExpiredMessageToClient extends BaseWebSocketMessage {
  type: 'session_expired';
  message: string;
  code: string;
}

// Union type for messages received by the server
export type WebSocketMessageToServer =
  | RegisterMessageToServer
  | TranscriptionMessageToServer
  | AudioMessageToServer
  | TTSRequestMessageToServer
  | SettingsMessageToServer
  | PingMessageToServer
  | BaseWebSocketMessage; // Fallback for unknown types

// Union type for messages sent by the server
export type WebSocketMessageToClient =
  | ConnectionMessageToClient
  | ClassroomCodeMessageToClient
  | RegisterResponseToClient
  | TranslationMessageToClient
  | TTSResponseMessageToClient
  | SettingsResponseToClient
  | PongMessageToClient
  | ErrorMessageToClient
  | SessionExpiredMessageToClient
  | StudentJoinedMessageToClient
  | BaseWebSocketMessage; // Fallback for ping etc.