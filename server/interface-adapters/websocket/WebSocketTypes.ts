export interface BaseWebSocketMessage {
  type: string;
  timestamp?: number;
}

export interface ClientSettings {
  ttsServiceType?: string;
  useClientSpeech?: boolean;
  translationMode?: 'auto' | 'manual';
  allowComprehensionSignals?: boolean;
  lowLiteracyMode?: boolean;
  aceEnabled?: boolean;
}

// --- Messages TO Server ---

export interface RegisterMessageToServer extends BaseWebSocketMessage {
  type: 'register';
  role: 'teacher' | 'student';
  languageCode: string;
  name?: string;
  classroomCode?: string;
  teacherId?: string;
  settings?: Partial<ClientSettings>;
  ttsServiceType?: string;
}

export interface TranscriptionMessageToServer extends BaseWebSocketMessage {
  type: 'transcription';
  text: string;
}

export interface AudioMessageToServer extends BaseWebSocketMessage {
  type: 'audio';
  data: string; // base64
  isFirstChunk?: boolean;
  isFinalChunk?: boolean;
  mimeType?: string;
}

// Student voice message (two-way)
export interface StudentAudioMessageToServer extends BaseWebSocketMessage {
  type: 'student_audio';
  data?: string; // base64 audio (optional when transcribedText provided)
  language?: string; // student's language
  transcribedText?: string; // optional, lets tests bypass STT
  visibility?: 'private' | 'class';
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
  ttsServiceType?: string;
}

export interface ManualSendTranslationMessageToServer extends BaseWebSocketMessage {
  type: 'send_translation';
  text: string;
}

export interface PingMessageToServer extends BaseWebSocketMessage {
  type: 'ping';
  timestamp: number;
}

// Live comprehension indicators (feature-flagged)
export interface ComprehensionSignalMessageToServer extends BaseWebSocketMessage {
  type: 'comprehension_signal';
  signal: 'need_slower' | 'confused' | 'ok' | 'repeat' | string;
}

// Two-way communication (feature-flagged)
export interface StudentRequestMessageToServer extends BaseWebSocketMessage {
  type: 'student_request';
  text: string;
  languageCode?: string;
  visibility?: 'private' | 'class';
  tags?: string[];
}

export interface TeacherReplyMessageToServer extends BaseWebSocketMessage {
  type: 'teacher_reply';
  text: string;
  scope: 'class' | 'private';
  requestId?: string; // required when scope === 'private'
}

// --- Messages FROM Server ---

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
  network?: number;
}

export interface TranslationMessageToClient extends BaseWebSocketMessage {
  type: 'translation';
  text: string;
  originalText: string;
  sourceLanguage: string;
  targetLanguage: string;
  ttsServiceType: string;
  audioFormat?: 'wav' | 'mp3' | 'browser';
  latency: {
    total: number;
    serverCompleteTime: number;
    components: LatencyComponents;
  };
  audioData?: string;
  useClientSpeech?: boolean;
  speechParams?: {
    type: 'browser-speech';
    text: string;
    languageCode: string;
    autoPlay: boolean;
    [key: string]: any;
  };
}

export interface TTSResponseMessageToClient extends BaseWebSocketMessage {
  type: 'tts_response';
  status: 'success' | 'error';
  text?: string;
  languageCode?: string;
  ttsServiceType?: string;
  audioData?: string;
  useClientSpeech?: boolean;
  speechParams?: {
    type: 'browser-speech';
    text: string;
    languageCode: string;
    autoPlay: boolean;
    [key: string]: any;
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

export interface TeacherModeMessageToClient extends BaseWebSocketMessage {
  type: 'teacher_mode';
  mode: 'auto' | 'manual';
}

// ACE teacher hint (feature-flagged)
export interface ACEHintMessageToClient extends BaseWebSocketMessage {
  type: 'ace_hint';
  message: string;
  level: 'info' | 'suggestion' | 'warning';
}

export interface ComprehensionSignalMessageToClient extends BaseWebSocketMessage {
  type: 'comprehension_signal';
  fromStudentId: string;
  signal: string;
}

export interface ManualSendAckToClient extends BaseWebSocketMessage {
  type: 'manual_send_ack';
  status: 'ok' | 'error';
  message?: string;
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

// Two-way communication (to Teacher)
export interface StudentRequestMessageToClient extends BaseWebSocketMessage {
  type: 'student_request';
  payload: {
    requestId: string;
    name?: string;
    languageCode?: string;
    text: string;
    visibility?: 'private' | 'class';
  };
}

export interface SessionExpiredMessageToClient extends BaseWebSocketMessage {
  type: 'session_expired';
  message: string;
  code: string;
}

// Unions
export type WebSocketMessageToServer =
  | RegisterMessageToServer
  | TranscriptionMessageToServer
  | AudioMessageToServer
  | StudentAudioMessageToServer
  | TTSRequestMessageToServer
  | SettingsMessageToServer
  | ManualSendTranslationMessageToServer
  | PingMessageToServer
  | ComprehensionSignalMessageToServer
  | StudentRequestMessageToServer
  | TeacherReplyMessageToServer
  | BaseWebSocketMessage;

export type WebSocketMessageToClient =
  | ConnectionMessageToClient
  | ClassroomCodeMessageToClient
  | RegisterResponseToClient
  | TranslationMessageToClient
  | TTSResponseMessageToClient
  | SettingsResponseToClient
  | TeacherModeMessageToClient
  | ACEHintMessageToClient
  | ManualSendAckToClient
  | PongMessageToClient
  | ErrorMessageToClient
  | SessionExpiredMessageToClient
  | StudentJoinedMessageToClient
  | ComprehensionSignalMessageToClient
  | StudentRequestMessageToClient
  | BaseWebSocketMessage;


