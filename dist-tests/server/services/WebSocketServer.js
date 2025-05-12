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
import { WebSocketServer as WSServer } from 'ws';
import { speechTranslationService } from './TranslationService';
import { URL } from 'url';
var WebSocketServer = /** @class */ (function () {
    function WebSocketServer(server) {
        // We use the speechTranslationService facade
        // Connection tracking
        this.connections = new Set();
        this.roles = new Map();
        this.languages = new Map();
        this.sessionIds = new Map();
        this.clientSettings = new Map();
        // Stats
        this.sessionCounter = 0;
        // Initialize WebSocket server with CORS settings
        this.wss = new WSServer({
            server: server,
            path: '/ws',
            // Add explicit CORS handling for WebSocket (following the Single Responsibility Principle)
            verifyClient: function (info, callback) {
                // Allow all origins for WebSocket connections
                console.log('WebSocket connection verification, headers:', JSON.stringify(info.req.headers, null, 2));
                callback(true); // Always accept the connection
            }
        });
        // We now use the imported speechTranslationService instead of creating a new instance
        // Set up event handlers
        this.setupEventHandlers();
        console.log('WebSocket server initialized and listening on path: /ws');
    }
    /**
     * Set up WebSocket server event handlers
     */
    WebSocketServer.prototype.setupEventHandlers = function () {
        var _this = this;
        // Handle new connections
        this.wss.on('connection', function (ws, request) {
            // Cast WebSocket to our custom WebSocketClient type
            _this.handleConnection(ws, request);
        });
        // Set up periodic ping to keep connections alive
        this.setupHeartbeat();
    };
    /**
     * Handle new WebSocket connection
     */
    WebSocketServer.prototype.handleConnection = function (ws, request) {
        var _this = this;
        try {
            // Log connection information
            console.log('New WebSocket connection from', request.socket.remoteAddress, 'path:', request.url);
            // Log headers for debugging
            console.log('Headers:', JSON.stringify(request.headers, null, 2));
            // Parse URL to get query parameters
            var url = new URL(request.url, "http://".concat(request.headers.host));
            var role = url.searchParams.get('role');
            var language = url.searchParams.get('language');
            // Set initial role from URL if provided
            if (role) {
                console.log("Setting initial role to '".concat(role, "' from URL query parameter"));
                this.roles.set(ws, role);
            }
            // Set initial language from URL if provided
            if (language) {
                this.languages.set(ws, language);
            }
            // Generate a unique session ID
            var sessionId = "session_".concat(Date.now(), "_").concat(this.sessionCounter++);
            this.sessionIds.set(ws, sessionId);
            ws.sessionId = sessionId;
            // Add to connections set
            this.connections.add(ws);
            // Mark as alive for heartbeat
            ws.isAlive = true;
            // Set up message handler
            ws.on('message', function (message) {
                _this.handleMessage(ws, message.toString());
            });
            // Set up close handler
            ws.on('close', function () {
                _this.handleClose(ws);
            });
            // Set up error handler
            ws.on('error', function (error) {
                console.error('WebSocket error:', error);
            });
            // Set up pong handler for heartbeat
            ws.on('pong', function () {
                ws.isAlive = true;
            });
            // Send connection confirmation
            this.sendConnectionConfirmation(ws);
        }
        catch (error) {
            console.error('Error handling new connection:', error);
        }
    };
    /**
     * Send connection confirmation to client
     */
    WebSocketServer.prototype.sendConnectionConfirmation = function (ws) {
        try {
            var sessionId = this.sessionIds.get(ws);
            var role = this.roles.get(ws);
            var language = this.languages.get(ws);
            var message = {
                type: 'connection',
                status: 'connected',
                sessionId: sessionId,
                role: role,
                language: language
            };
            ws.send(JSON.stringify(message));
            console.log('Sending connection confirmation with sessionId:', sessionId);
            console.log('Connection confirmation sent successfully');
        }
        catch (error) {
            console.error('Error sending connection confirmation:', error);
        }
    };
    /**
     * Handle incoming WebSocket message
     */
    WebSocketServer.prototype.handleMessage = function (ws, data) {
        return __awaiter(this, void 0, void 0, function () {
            var message, _a, error_1;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _b.trys.push([0, 13, , 14]);
                        message = JSON.parse(data);
                        _a = message.type;
                        switch (_a) {
                            case 'register': return [3 /*break*/, 1];
                            case 'transcription': return [3 /*break*/, 2];
                            case 'tts_request': return [3 /*break*/, 4];
                            case 'audio': return [3 /*break*/, 6];
                            case 'settings': return [3 /*break*/, 8];
                            case 'ping': return [3 /*break*/, 9];
                            case 'pong': return [3 /*break*/, 10];
                        }
                        return [3 /*break*/, 11];
                    case 1:
                        this.handleRegisterMessage(ws, message);
                        return [3 /*break*/, 12];
                    case 2: return [4 /*yield*/, this.handleTranscriptionMessage(ws, message)];
                    case 3:
                        _b.sent();
                        return [3 /*break*/, 12];
                    case 4: return [4 /*yield*/, this.handleTTSRequestMessage(ws, message)];
                    case 5:
                        _b.sent();
                        return [3 /*break*/, 12];
                    case 6: return [4 /*yield*/, this.handleAudioMessage(ws, message)];
                    case 7:
                        _b.sent();
                        return [3 /*break*/, 12];
                    case 8:
                        this.handleSettingsMessage(ws, message);
                        return [3 /*break*/, 12];
                    case 9:
                        this.handlePingMessage(ws, message);
                        return [3 /*break*/, 12];
                    case 10: 
                    // No specific handling needed
                    return [3 /*break*/, 12];
                    case 11:
                        console.warn('Unknown message type:', message.type);
                        _b.label = 12;
                    case 12: return [3 /*break*/, 14];
                    case 13:
                        error_1 = _b.sent();
                        console.error('Error handling message:', error_1);
                        return [3 /*break*/, 14];
                    case 14: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Handle registration message
     */
    WebSocketServer.prototype.handleRegisterMessage = function (ws, message) {
        var _a;
        console.log('Processing message type=register from connection:', "role=".concat(message.role, ", languageCode=").concat(message.languageCode));
        var currentRole = this.roles.get(ws);
        // Update role if provided
        if (message.role) {
            if (currentRole !== message.role) {
                console.log("Changing connection role from ".concat(currentRole, " to ").concat(message.role));
            }
            this.roles.set(ws, message.role);
        }
        // Update language if provided
        if (message.languageCode) {
            this.languages.set(ws, message.languageCode);
        }
        // Store client settings
        var settings = this.clientSettings.get(ws) || {};
        // Update text-to-speech service type if provided
        if ((_a = message.settings) === null || _a === void 0 ? void 0 : _a.ttsServiceType) {
            settings.ttsServiceType = message.settings.ttsServiceType;
            console.log("Client requested TTS service type: ".concat(settings.ttsServiceType));
        }
        // Store updated settings
        this.clientSettings.set(ws, settings);
        console.log('Updated connection:', "role=".concat(this.roles.get(ws), ", languageCode=").concat(this.languages.get(ws), ", ttsService=").concat(settings.ttsServiceType || 'default'));
        // Send confirmation
        var response = {
            type: 'register',
            status: 'success',
            data: {
                role: this.roles.get(ws),
                languageCode: this.languages.get(ws),
                settings: settings
            }
        };
        ws.send(JSON.stringify(response));
    };
    /**
     * Handle transcription message
     */
    WebSocketServer.prototype.handleTranscriptionMessage = function (ws, message) {
        return __awaiter(this, void 0, void 0, function () {
            var startTime, latencyTracking, role, sessionId, studentConnections, studentLanguages, teacherLanguage, translations, translationResults, _loop_1, this_1, _i, studentLanguages_1, targetLanguage, processingEndTime;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        console.log('Received transcription from', this.roles.get(ws), ':', message.text);
                        startTime = Date.now();
                        latencyTracking = {
                            start: startTime,
                            components: {
                                preparation: 0,
                                translation: 0,
                                tts: 0,
                                processing: 0
                            }
                        };
                        role = this.roles.get(ws);
                        sessionId = this.sessionIds.get(ws);
                        // Only process transcriptions from teacher
                        if (role !== 'teacher') {
                            console.warn('Ignoring transcription from non-teacher role:', role);
                            return [2 /*return*/];
                        }
                        studentConnections = [];
                        studentLanguages = [];
                        this.connections.forEach(function (client) {
                            var clientRole = _this.roles.get(client);
                            var clientLanguage = _this.languages.get(client);
                            if (clientRole === 'student' && clientLanguage) {
                                studentConnections.push(client);
                                // Only add unique languages
                                if (!studentLanguages.includes(clientLanguage)) {
                                    studentLanguages.push(clientLanguage);
                                }
                            }
                        });
                        if (studentConnections.length === 0) {
                            console.log('No students connected, skipping translation');
                            return [2 /*return*/];
                        }
                        teacherLanguage = this.languages.get(ws) || 'en-US';
                        translations = {};
                        translationResults = {};
                        _loop_1 = function (targetLanguage) {
                            var teacherTtsServiceType_1, ttsServiceToUse, translationStartTime, result, translationEndTime, elapsedTime, ttsTime, translationTime, error_2;
                            return __generator(this, function (_b) {
                                switch (_b.label) {
                                    case 0:
                                        _b.trys.push([0, 2, , 3]);
                                        teacherTtsServiceType_1 = process.env.TTS_SERVICE_TYPE || 'browser';
                                        // Look for the teacher's TTS service preference
                                        this_1.connections.forEach(function (client) {
                                            var _a, _b;
                                            if (_this.roles.get(client) === 'teacher' &&
                                                ((_a = _this.clientSettings.get(client)) === null || _a === void 0 ? void 0 : _a.ttsServiceType)) {
                                                // Use the teacher's preference for all student translations
                                                teacherTtsServiceType_1 = (_b = _this.clientSettings.get(client)) === null || _b === void 0 ? void 0 : _b.ttsServiceType;
                                            }
                                        });
                                        ttsServiceToUse = 'openai';
                                        console.log("Using OpenAI TTS service for language '".concat(targetLanguage, "' (overriding teacher's selection)"));
                                        translationStartTime = Date.now();
                                        return [4 /*yield*/, speechTranslationService.translateSpeech(Buffer.from(''), // Empty buffer as we already have the text
                                            teacherLanguage, targetLanguage, message.text, // Use the pre-transcribed text
                                            { ttsServiceType: ttsServiceToUse } // Force OpenAI TTS service
                                            )];
                                    case 1:
                                        result = _b.sent();
                                        translationEndTime = Date.now();
                                        elapsedTime = translationEndTime - translationStartTime;
                                        ttsTime = Math.round(elapsedTime * 0.7);
                                        translationTime = elapsedTime - ttsTime;
                                        latencyTracking.components.translation = Math.max(latencyTracking.components.translation, translationTime);
                                        latencyTracking.components.tts = Math.max(latencyTracking.components.tts, ttsTime);
                                        // Store the full result object for this language
                                        translationResults[targetLanguage] = result;
                                        // Also store just the text for backward compatibility
                                        translations[targetLanguage] = result.translatedText;
                                        return [3 /*break*/, 3];
                                    case 2:
                                        error_2 = _b.sent();
                                        console.error("Error translating to ".concat(targetLanguage, ":"), error_2);
                                        translations[targetLanguage] = message.text; // Fallback to original text
                                        translationResults[targetLanguage] = {
                                            originalText: message.text,
                                            translatedText: message.text,
                                            audioBuffer: Buffer.from('') // Empty buffer for fallback
                                        };
                                        return [3 /*break*/, 3];
                                    case 3: return [2 /*return*/];
                                }
                            });
                        };
                        this_1 = this;
                        _i = 0, studentLanguages_1 = studentLanguages;
                        _a.label = 1;
                    case 1:
                        if (!(_i < studentLanguages_1.length)) return [3 /*break*/, 4];
                        targetLanguage = studentLanguages_1[_i];
                        return [5 /*yield**/, _loop_1(targetLanguage)];
                    case 2:
                        _a.sent();
                        _a.label = 3;
                    case 3:
                        _i++;
                        return [3 /*break*/, 1];
                    case 4:
                        processingEndTime = Date.now();
                        latencyTracking.components.processing = processingEndTime - startTime - latencyTracking.components.translation;
                        // Send translations to students
                        studentConnections.forEach(function (client) {
                            var studentLanguage = _this.languages.get(client);
                            if (!studentLanguage)
                                return;
                            var translatedText = translations[studentLanguage] || message.text;
                            // Always use OpenAI TTS service - ignore any other settings
                            var ttsServiceType = 'openai';
                            // Calculate total latency up to this point
                            var currentTime = Date.now();
                            var totalLatency = currentTime - startTime;
                            // Create translation message with audio data support and latency metrics
                            var translationMessage = {
                                type: 'translation',
                                text: translatedText,
                                originalText: message.text,
                                sourceLanguage: teacherLanguage,
                                targetLanguage: studentLanguage,
                                ttsServiceType: ttsServiceType, // Include the service type for client reference
                                latency: {
                                    total: totalLatency,
                                    serverCompleteTime: currentTime, // Timestamp when server completed processing
                                    components: {
                                        translation: latencyTracking.components.translation,
                                        tts: latencyTracking.components.tts,
                                        processing: latencyTracking.components.processing,
                                        network: 0 // Will be calculated on client side
                                    }
                                }
                            };
                            // If we have a translation result with audio buffer, include it
                            if (translationResults[studentLanguage] && translationResults[studentLanguage].audioBuffer) {
                                try {
                                    var audioBuffer = translationResults[studentLanguage].audioBuffer;
                                    // Check if this is a special marker for browser speech synthesis
                                    var bufferString = audioBuffer.toString('utf8');
                                    if (bufferString.startsWith('{"type":"browser-speech"')) {
                                        // This is a marker for browser-based speech synthesis
                                        console.log("Using client browser speech synthesis for ".concat(studentLanguage));
                                        translationMessage.useClientSpeech = true;
                                        try {
                                            translationMessage.speechParams = JSON.parse(bufferString);
                                            console.log("Successfully parsed speech params for ".concat(studentLanguage));
                                        }
                                        catch (jsonError) {
                                            console.error('Error parsing speech params:', jsonError);
                                            translationMessage.speechParams = {
                                                type: 'browser-speech',
                                                text: translatedText,
                                                languageCode: studentLanguage,
                                                autoPlay: true
                                            };
                                        }
                                    }
                                    else if (audioBuffer.length > 0) {
                                        // This is actual audio data - encode as base64
                                        translationMessage.audioData = audioBuffer.toString('base64');
                                        translationMessage.useClientSpeech = false; // Explicitly set to false
                                        // Log audio data details for debugging
                                        console.log("Sending ".concat(audioBuffer.length, " bytes of audio data to client"));
                                        console.log("Using OpenAI TTS service for ".concat(studentLanguage, " (teacher preference: ").concat(ttsServiceType, ")"));
                                        console.log("First 16 bytes of audio: ".concat(Array.from(audioBuffer.slice(0, 16)).map(function (b) { return b.toString(16).padStart(2, '0'); }).join(' ')));
                                    }
                                }
                                catch (error) {
                                    console.error('Error processing audio data for translation:', error);
                                }
                            }
                            else {
                                console.log("Warning: No audio buffer available for language ".concat(studentLanguage, " with TTS service ").concat(ttsServiceType));
                            }
                            client.send(JSON.stringify(translationMessage));
                        });
                        return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Handle audio message
     */
    WebSocketServer.prototype.handleAudioMessage = function (ws, message) {
        return __awaiter(this, void 0, void 0, function () {
            var role, sessionId;
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        role = this.roles.get(ws);
                        sessionId = this.sessionIds.get(ws);
                        console.log('Processing message type=audio from connection:', "role=".concat(role, ", languageCode=").concat(this.languages.get(ws)));
                        if (!(role === 'teacher')) return [3 /*break*/, 2];
                        console.log('Processing teacher audio (detected from role info), data length:', (_a = message.data) === null || _a === void 0 ? void 0 : _a.length);
                        return [4 /*yield*/, this.processTeacherAudio(ws, message.data)];
                    case 1:
                        _b.sent();
                        return [3 /*break*/, 3];
                    case 2:
                        console.log('Ignoring audio from non-teacher role:', role);
                        _b.label = 3;
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Process audio from teacher
     */
    WebSocketServer.prototype.processTeacherAudio = function (ws, audioData) {
        return __awaiter(this, void 0, void 0, function () {
            var sessionId, teacherSessionId;
            return __generator(this, function (_a) {
                if (!audioData || audioData.length < 100) {
                    console.log('Received invalid or too small audio data (length:', audioData === null || audioData === void 0 ? void 0 : audioData.length, ')');
                    return [2 /*return*/];
                }
                console.log('Processing audio data (length:', audioData.length, ') from teacher...');
                sessionId = this.sessionIds.get(ws);
                teacherSessionId = "teacher_".concat(sessionId);
                // In a real implementation, this would process the audio and get transcription
                // Since we're using Web Speech API on the client side, this is just a fallback
                console.warn("\u26A0\uFE0F No Web Speech API transcription found for ".concat(teacherSessionId, ", cannot process audio"));
                return [2 /*return*/];
            });
        });
    };
    /**
     * Handle TTS request message
     *
     * Follows SOLID principles - Single Responsibility:
     * This method only coordinates the TTS request handling,
     * delegating the actual work to specialized methods
     */
    WebSocketServer.prototype.handleTTSRequestMessage = function (ws, message) {
        return __awaiter(this, void 0, void 0, function () {
            var role, languageCode, ttsService, text, audioResult, error_3, errorMsg;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        role = this.roles.get(ws);
                        languageCode = message.languageCode || this.languages.get(ws);
                        ttsService = 'openai';
                        text = message.text;
                        console.log("Received TTS request from ".concat(role, " (forcing OpenAI TTS service) in language ").concat(languageCode));
                        if (!this.validateTTSRequest(text, languageCode)) {
                            return [2 /*return*/];
                        }
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 4, , 6]);
                        return [4 /*yield*/, this.generateTTSAudio(text, languageCode, ttsService)];
                    case 2:
                        audioResult = _a.sent();
                        return [4 /*yield*/, this.sendTTSResponse(ws, __assign({ text: text, languageCode: languageCode, ttsService: ttsService }, audioResult))];
                    case 3:
                        _a.sent();
                        return [3 /*break*/, 6];
                    case 4:
                        error_3 = _a.sent();
                        errorMsg = error_3 instanceof Error ? error_3.message : String(error_3);
                        return [4 /*yield*/, this.sendTTSErrorResponse(ws, {
                                text: text,
                                languageCode: languageCode,
                                ttsService: ttsService,
                                errorMsg: errorMsg
                            })];
                    case 5:
                        _a.sent();
                        return [3 /*break*/, 6];
                    case 6: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Validate TTS request parameters
     *
     * @param text The text to synthesize
     * @param languageCode The language code for synthesis
     * @returns boolean indicating if the request is valid
     */
    WebSocketServer.prototype.validateTTSRequest = function (text, languageCode) {
        if (!text || !languageCode) {
            console.error('Missing required parameters for TTS request');
            return false;
        }
        return true;
    };
    /**
     * Generate audio using the specified TTS service
     *
     * @param text The text to synthesize
     * @param languageCode The language code for synthesis
     * @param ttsService The TTS service to use
     * @returns Object containing success status and audio buffer (if successful)
     */
    WebSocketServer.prototype.generateTTSAudio = function (text, languageCode, ttsService) {
        return __awaiter(this, void 0, void 0, function () {
            var result, error_4;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, speechTranslationService.translateSpeech(Buffer.from(''), // Empty buffer since we have the text
                            'en-US', // Source language doesn't matter for TTS
                            languageCode, text, // The text to synthesize
                            { ttsServiceType: ttsService } // Pass TTS service directly
                            )];
                    case 1:
                        result = _a.sent();
                        // Check if we have valid audio data
                        if (result && result.audioBuffer && result.audioBuffer.length > 0) {
                            return [2 /*return*/, {
                                    success: true,
                                    audioData: result.audioBuffer.toString('base64')
                                }];
                        }
                        else {
                            console.warn("No audio data generated for TTS service ".concat(ttsService));
                            return [2 /*return*/, {
                                    success: false,
                                    error: 'No audio data generated'
                                }];
                        }
                        return [3 /*break*/, 3];
                    case 2:
                        error_4 = _a.sent();
                        console.error("Error generating audio for TTS service ".concat(ttsService, ":"), error_4);
                        return [2 /*return*/, {
                                success: false,
                                error: error_4 instanceof Error ? error_4.message : String(error_4)
                            }];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Send successful TTS response to client
     *
     * @param ws The WebSocket client to send response to
     * @param responseData The response data
     */
    WebSocketServer.prototype.sendTTSResponse = function (ws, responseData) {
        return __awaiter(this, void 0, void 0, function () {
            var response;
            return __generator(this, function (_a) {
                response = __assign({ type: 'tts_response' }, responseData);
                ws.send(JSON.stringify(response));
                return [2 /*return*/];
            });
        });
    };
    /**
     * Send error TTS response to client
     *
     * @param ws The WebSocket client to send response to
     * @param errorData The error data
     */
    WebSocketServer.prototype.sendTTSErrorResponse = function (ws, errorData) {
        return __awaiter(this, void 0, void 0, function () {
            var errorResponse;
            return __generator(this, function (_a) {
                console.error("Error processing TTS request with service ".concat(errorData.ttsService, ":"), errorData.errorMsg);
                errorResponse = {
                    type: 'tts_response',
                    text: errorData.text,
                    ttsService: errorData.ttsService,
                    languageCode: errorData.languageCode,
                    success: false,
                    error: errorData.errorMsg
                };
                ws.send(JSON.stringify(errorResponse));
                return [2 /*return*/];
            });
        });
    };
    /**
     * Handle settings message
     *
     * Updates client settings such as TTS service type
     */
    WebSocketServer.prototype.handleSettingsMessage = function (ws, message) {
        var role = this.roles.get(ws);
        console.log("Processing settings update from ".concat(role, ":"), message);
        // Get existing settings or create new object
        var settings = this.clientSettings.get(ws) || {};
        // Update TTS service type if provided
        if (message.ttsServiceType) {
            settings.ttsServiceType = message.ttsServiceType;
            console.log("Updated TTS service type for ".concat(role, " to: ").concat(settings.ttsServiceType));
        }
        // Store updated settings
        this.clientSettings.set(ws, settings);
        // If this is a teacher, log that the TTS service preference will be used for all students
        if (role === 'teacher' && message.ttsServiceType) {
            console.log("Teacher's TTS service preference set to '".concat(message.ttsServiceType, "'. This will be used for all student translations."));
        }
        // Send confirmation
        var response = {
            type: 'settings',
            status: 'success',
            data: settings
        };
        ws.send(JSON.stringify(response));
    };
    /**
     * Handle ping message for latency measurement
     */
    WebSocketServer.prototype.handlePingMessage = function (ws, message) {
        try {
            // Get client information
            var role = this.roles.get(ws) || 'unknown';
            var language = this.languages.get(ws) || 'unknown';
            var sessionId = this.sessionIds.get(ws) || 'unknown';
            // Calculate server processing time
            var serverReceiveTime = Date.now();
            // Log ping request for diagnostics
            console.log("Received ping request from ".concat(role, " (").concat(sessionId, "), timestamp: ").concat(message.timestamp));
            // Respond with pong message
            var response = {
                type: 'pong',
                timestamp: message.timestamp,
                serverReceiveTime: serverReceiveTime,
                serverSendTime: Date.now(),
                clientInfo: {
                    role: role,
                    language: language,
                    sessionId: sessionId
                }
            };
            ws.send(JSON.stringify(response));
        }
        catch (error) {
            console.error('Error handling ping message:', error);
        }
    };
    /**
     * Handle WebSocket close event
     */
    WebSocketServer.prototype.handleClose = function (ws) {
        console.log('WebSocket disconnected, sessionId:', this.sessionIds.get(ws));
        // Remove from all tracking maps
        this.connections.delete(ws);
        this.roles.delete(ws);
        this.languages.delete(ws);
        this.sessionIds.delete(ws);
    };
    /**
     * Set up heartbeat mechanism to detect stale connections
     */
    WebSocketServer.prototype.setupHeartbeat = function () {
        var _this = this;
        var interval = setInterval(function () {
            _this.wss.clients.forEach(function (ws) {
                // Cast the standard WebSocket to our custom type 
                var client = ws;
                if (client.isAlive === false) {
                    console.log('Terminating inactive WebSocket connection');
                    return client.terminate();
                }
                client.isAlive = false;
                client.ping();
                // Also send a ping message for clients that don't respond to standard pings
                var pingMessage = {
                    type: 'ping',
                    timestamp: Date.now()
                };
                try {
                    client.send(JSON.stringify(pingMessage));
                }
                catch (error) {
                    // Ignore errors during ping
                }
            });
        }, 30000); // Check every 30 seconds
        // Clear interval on server close
        this.wss.on('close', function () {
            clearInterval(interval);
        });
    };
    /**
     * Get all active connections
     */
    WebSocketServer.prototype.getConnections = function () {
        return this.connections;
    };
    /**
     * Get role for a specific connection
     */
    WebSocketServer.prototype.getRole = function (ws) {
        return this.roles.get(ws);
    };
    /**
     * Get language for a specific connection
     */
    WebSocketServer.prototype.getLanguage = function (ws) {
        return this.languages.get(ws);
    };
    return WebSocketServer;
}());
export { WebSocketServer };
//# sourceMappingURL=WebSocketServer.js.map