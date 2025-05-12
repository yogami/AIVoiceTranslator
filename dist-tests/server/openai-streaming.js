var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
/**
 * OpenAI Streaming Audio Transcription Service
 *
 * Provides real-time transcription for audio streams using OpenAI's Whisper model.
 *
 * This module follows SOLID principles:
 * - Single Responsibility: Each class and function has a specific purpose
 * - Open/Closed: Components can be extended without modification
 * - Liskov Substitution: Interfaces define contracts that implementations must follow
 * - Interface Segregation: Each interface exposes only what clients need
 * - Dependency Inversion: High-level modules depend on abstractions
 */
import OpenAI from 'openai';
import { WebSocketState } from './websocket';
// Configuration constants - making magic numbers explicit
var CONFIG = {
    CLEANUP_INTERVAL_MS: 30000, // How often to check for and remove inactive sessions
    SESSION_MAX_AGE_MS: 60000, // How long a session can be inactive before cleanup
    MIN_AUDIO_SIZE_BYTES: 2000, // Minimum audio chunk size to process
    MAX_AUDIO_BUFFER_BYTES: 640000, // ~5 seconds at 128kbps
    WHISPER_MODEL: 'whisper-1', // OpenAI model to use for transcription
    LOG_PREFIX: '[OpenAI Streaming]' // Prefix for all logs from this module
};
// Log API key status (masked for security)
console.log("OpenAI Streaming - API key status: ".concat(process.env.OPENAI_API_KEY ? 'Present' : 'Missing'));
/**
 * OpenAI client initialization - follows the factory pattern
 * Using a class instead of a global variable for better encapsulation
 */
var OpenAIClientFactory = /** @class */ (function () {
    function OpenAIClientFactory() {
    }
    /**
     * Get the OpenAI client instance (singleton pattern)
     */
    OpenAIClientFactory.getInstance = function () {
        if (!this.instance) {
            try {
                this.instance = new OpenAI({
                    apiKey: process.env.OPENAI_API_KEY || 'sk-placeholder-for-initialization-only'
                });
                console.log('OpenAI Streaming - client initialized successfully');
            }
            catch (error) {
                console.error('OpenAI Streaming - Error initializing client:', error);
                // Create a placeholder client that will throw proper errors when methods are called
                this.instance = new OpenAI({ apiKey: 'sk-placeholder-for-initialization-only' });
            }
        }
        return this.instance;
    };
    return OpenAIClientFactory;
}());
/**
 * Session Manager - responsible for maintaining session state
 * Follows the repository pattern for data access
 */
var SessionManager = /** @class */ (function () {
    function SessionManager() {
        this.sessions = new Map();
    }
    /**
     * Create a new streaming session
     */
    SessionManager.prototype.createSession = function (sessionId, language, initialBuffer) {
        var session = {
            sessionId: sessionId,
            language: language,
            isProcessing: false,
            audioBuffer: [initialBuffer],
            lastChunkTime: Date.now(),
            transcriptionText: '',
            transcriptionInProgress: false
        };
        this.sessions.set(sessionId, session);
        console.log("".concat(CONFIG.LOG_PREFIX, " Created new session: ").concat(sessionId, ", language: ").concat(language));
        return session;
    };
    /**
     * Get an existing session
     */
    SessionManager.prototype.getSession = function (sessionId) {
        return this.sessions.get(sessionId);
    };
    /**
     * Add audio data to an existing session
     */
    SessionManager.prototype.addAudioToSession = function (sessionId, audioBuffer) {
        var session = this.getSession(sessionId);
        if (session) {
            session.audioBuffer.push(audioBuffer);
            session.lastChunkTime = Date.now();
        }
    };
    /**
     * Delete a session
     */
    SessionManager.prototype.deleteSession = function (sessionId) {
        var result = this.sessions.delete(sessionId);
        if (result) {
            console.log("".concat(CONFIG.LOG_PREFIX, " Deleted session: ").concat(sessionId));
        }
        return result;
    };
    /**
     * Clean up inactive sessions
     */
    SessionManager.prototype.cleanupInactiveSessions = function (maxAgeMs) {
        if (maxAgeMs === void 0) { maxAgeMs = CONFIG.SESSION_MAX_AGE_MS; }
        var now = Date.now();
        // Convert entries to array first (avoids downlevelIteration issues)
        for (var _i = 0, _a = Array.from(this.sessions.entries()); _i < _a.length; _i++) {
            var _b = _a[_i], sessionId = _b[0], session = _b[1];
            var sessionAge = now - session.lastChunkTime;
            if (sessionAge > maxAgeMs) {
                console.log("".concat(CONFIG.LOG_PREFIX, " Cleaning up inactive session: ").concat(sessionId, ", age: ").concat(sessionAge, "ms"));
                this.sessions.delete(sessionId);
            }
        }
    };
    /**
     * Get all sessions
     */
    SessionManager.prototype.getAllSessions = function () {
        return this.sessions;
    };
    return SessionManager;
}());
// Singleton instance of the session manager
var sessionManager = new SessionManager();
/**
 * WebSocket communication utilities
 * Encapsulates message formatting and sending
 */
var WebSocketCommunicator = /** @class */ (function () {
    function WebSocketCommunicator() {
    }
    /**
     * Send a transcription result over WebSocket
     */
    WebSocketCommunicator.sendTranscriptionResult = function (ws, result) {
        this.sendMessage(ws, __assign({ type: 'transcription' }, result));
    };
    /**
     * Send an error message over WebSocket
     */
    WebSocketCommunicator.sendErrorMessage = function (ws, message, errorType) {
        if (errorType === void 0) { errorType = 'server_error'; }
        this.sendMessage(ws, {
            type: 'error',
            message: message,
            errorType: errorType
        });
    };
    /**
     * Send a generic message over WebSocket
     * Private helper method used by other public methods
     */
    WebSocketCommunicator.sendMessage = function (ws, message) {
        // Only send if the connection is open
        if (ws.readyState === WebSocketState.OPEN) {
            ws.send(JSON.stringify(message));
        }
    };
    return WebSocketCommunicator;
}());
/**
 * Audio Processing Service - handles transcription using OpenAI
 */
var AudioProcessingService = /** @class */ (function () {
    function AudioProcessingService() {
        // Get the OpenAI client from our factory
        this.openai = OpenAIClientFactory.getInstance();
    }
    /**
     * Process audio buffer and get transcription
     */
    AudioProcessingService.prototype.transcribeAudio = function (audioBuffer, language) {
        return __awaiter(this, void 0, void 0, function () {
            var webmBlob, file, baseLanguage, transcription, error_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        webmBlob = new Blob([audioBuffer], { type: 'audio/webm' });
                        file = new File([webmBlob], 'audio.webm', { type: 'audio/webm' });
                        baseLanguage = language.split('-')[0];
                        return [4 /*yield*/, this.openai.audio.transcriptions.create({
                                file: file,
                                model: CONFIG.WHISPER_MODEL,
                                language: baseLanguage,
                                response_format: 'json',
                            })];
                    case 1:
                        transcription = _a.sent();
                        return [2 /*return*/, transcription.text || ''];
                    case 2:
                        error_1 = _a.sent();
                        console.error("".concat(CONFIG.LOG_PREFIX, " Transcription error:"), error_1);
                        throw new Error("Transcription failed: ".concat(error_1 instanceof Error ? error_1.message : 'Unknown error'));
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    return AudioProcessingService;
}());
// Create a single instance of the audio processor
var audioProcessor = new AudioProcessingService();
/**
 * Process streaming audio data from WebSocket
 *
 * @param ws WebSocket connection
 * @param sessionId Unique session ID
 * @param audioBase64 Base64-encoded audio data
 * @param isFirstChunk Whether this is the first chunk in a new stream
 * @param language Language code for transcription (e.g., 'en-US')
 */
export function processStreamingAudio(ws, sessionId, audioBase64, isFirstChunk, language) {
    return __awaiter(this, void 0, void 0, function () {
        var audioBuffer, session;
        return __generator(this, function (_a) {
            try {
                audioBuffer = Buffer.from(audioBase64, 'base64');
                // Initialize session if it's the first chunk or doesn't exist
                if (isFirstChunk || !sessionManager.getSession(sessionId)) {
                    sessionManager.createSession(sessionId, language, audioBuffer);
                }
                else {
                    // Add to existing session
                    sessionManager.addAudioToSession(sessionId, audioBuffer);
                }
                session = sessionManager.getSession(sessionId);
                if (session && !session.transcriptionInProgress) {
                    // Start processing in the background
                    processAudioChunks(ws, sessionId).catch(function (error) {
                        console.error("".concat(CONFIG.LOG_PREFIX, " Error processing audio chunks:"), error);
                        WebSocketCommunicator.sendErrorMessage(ws, 'Error processing audio stream', 'server_error');
                    });
                }
            }
            catch (error) {
                console.error("".concat(CONFIG.LOG_PREFIX, " Error processing streaming audio:"), error);
                WebSocketCommunicator.sendErrorMessage(ws, 'Failed to process audio data', 'server_error');
            }
            return [2 /*return*/];
        });
    });
}
/**
 * Process accumulated audio chunks for a session
 *
 * @param ws WebSocket connection
 * @param sessionId Session ID
 */
function processAudioChunks(ws, sessionId) {
    return __awaiter(this, void 0, void 0, function () {
        var session, combinedBuffer, transcriptionText, error_2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    session = sessionManager.getSession(sessionId);
                    if (!session || session.audioBuffer.length === 0)
                        return [2 /*return*/];
                    // Mark as processing to prevent concurrent processing
                    session.transcriptionInProgress = true;
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, 4, 5]);
                    combinedBuffer = Buffer.concat(session.audioBuffer);
                    // Manage buffer size to maintain context but reduce processing load
                    if (combinedBuffer.length > CONFIG.MAX_AUDIO_BUFFER_BYTES) {
                        // Keep only the most recent audio
                        session.audioBuffer = [combinedBuffer.slice(-CONFIG.MAX_AUDIO_BUFFER_BYTES)];
                    }
                    else {
                        // Clear processed audio chunks
                        session.audioBuffer = [];
                    }
                    // Skip processing if buffer is too small
                    if (combinedBuffer.length < CONFIG.MIN_AUDIO_SIZE_BYTES) {
                        session.transcriptionInProgress = false;
                        return [2 /*return*/];
                    }
                    return [4 /*yield*/, audioProcessor.transcribeAudio(combinedBuffer, session.language)];
                case 2:
                    transcriptionText = _a.sent();
                    // Send result if we got meaningful text
                    if (transcriptionText && transcriptionText.trim() !== '') {
                        // Store the latest transcription for finalization
                        session.transcriptionText = transcriptionText;
                        // Send back transcription result
                        WebSocketCommunicator.sendTranscriptionResult(ws, {
                            text: transcriptionText,
                            isFinal: false,
                            languageCode: session.language
                        });
                    }
                    return [3 /*break*/, 5];
                case 3:
                    error_2 = _a.sent();
                    console.error("".concat(CONFIG.LOG_PREFIX, " Error transcribing audio:"), error_2);
                    WebSocketCommunicator.sendErrorMessage(ws, 'Failed to transcribe audio', 'server_error');
                    return [3 /*break*/, 5];
                case 4:
                    // Mark as done processing
                    session.transcriptionInProgress = false;
                    return [7 /*endfinally*/];
                case 5: return [2 /*return*/];
            }
        });
    });
}
/**
 * Finalize a streaming session
 *
 * @param ws WebSocket connection
 * @param sessionId Session ID
 */
export function finalizeStreamingSession(ws, sessionId) {
    return __awaiter(this, void 0, void 0, function () {
        var session, error_3;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 3, , 4]);
                    session = sessionManager.getSession(sessionId);
                    if (!session)
                        return [2 /*return*/];
                    if (!(session.audioBuffer.length > 0)) return [3 /*break*/, 2];
                    return [4 /*yield*/, processAudioChunks(ws, sessionId)];
                case 1:
                    _a.sent();
                    _a.label = 2;
                case 2:
                    // Send final transcription
                    WebSocketCommunicator.sendTranscriptionResult(ws, {
                        text: session.transcriptionText,
                        isFinal: true,
                        languageCode: session.language
                    });
                    // Clean up the session
                    sessionManager.deleteSession(sessionId);
                    console.log("".concat(CONFIG.LOG_PREFIX, " Finalized and closed session: ").concat(sessionId));
                    return [3 /*break*/, 4];
                case 3:
                    error_3 = _a.sent();
                    console.error("".concat(CONFIG.LOG_PREFIX, " Error finalizing session:"), error_3);
                    return [3 /*break*/, 4];
                case 4: return [2 /*return*/];
            }
        });
    });
}
/**
 * Clean up inactive streaming sessions
 * This should be called periodically to prevent memory leaks
 */
export function cleanupInactiveStreamingSessions(maxAgeMs) {
    if (maxAgeMs === void 0) { maxAgeMs = CONFIG.SESSION_MAX_AGE_MS; }
    sessionManager.cleanupInactiveSessions(maxAgeMs);
}
// Set up a periodic cleanup task
setInterval(function () {
    cleanupInactiveStreamingSessions();
}, CONFIG.CLEANUP_INTERVAL_MS);
//# sourceMappingURL=openai-streaming.js.map