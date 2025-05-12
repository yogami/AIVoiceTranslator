/**
 * Translation Service
 *
 * This service is responsible for transcribing and translating speech.
 * It applies the following principles:
 * - Single Responsibility Principle (SRP): Each class has one job
 * - Open/Closed Principle: Open for extension, closed for modification
 * - Interface Segregation: Clients depend only on what they need
 * - Dependency Inversion: Depend on abstractions
 * - Pragmatic Principle #11: DRY - Don't Repeat Yourself
 * - Pragmatic Principle #13: Eliminate Effects Between Unrelated Things
 * - Pragmatic Principle #17: Program Close to the Problem Domain
 */
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
import fs from 'fs';
import path from 'path';
import OpenAI from 'openai';
import { ttsFactory } from './TextToSpeechService';
// Add these at the top of the file (after existing imports)
import { promisify } from 'util';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
// Add this code near the top of the file
var __filename = fileURLToPath(import.meta.url);
var __dirname = path.dirname(__filename);
// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
// Promisify file system operations
var writeFile = promisify(fs.writeFile);
var unlink = promisify(fs.unlink);
var stat = promisify(fs.stat);
// Constants for configuration
var TEMP_DIR = '/home/runner/workspace';
var DEFAULT_WHISPER_MODEL = 'whisper-1';
var DEFAULT_CHAT_MODEL = 'gpt-4o'; // the newest OpenAI model is "gpt-4o" which was released May 13, 2024
// Language maps for better domain representation
var LANGUAGE_MAP = {
    'en-US': 'English',
    'fr-FR': 'French',
    'es-ES': 'Spanish',
    'de-DE': 'German',
    'it-IT': 'Italian',
    'ja-JP': 'Japanese',
    'ko-KR': 'Korean',
    'pt-BR': 'Portuguese',
    'ru-RU': 'Russian',
    'zh-CN': 'Chinese (Simplified)',
    'ar-SA': 'Arabic',
    'hi-IN': 'Hindi',
    'tr-TR': 'Turkish',
    'nl-NL': 'Dutch',
    'pl-PL': 'Polish',
    'sv-SE': 'Swedish',
    'da-DK': 'Danish',
    'fi-FI': 'Finnish',
    'no-NO': 'Norwegian',
    'cs-CZ': 'Czech',
    'hu-HU': 'Hungarian',
    'el-GR': 'Greek',
    'he-IL': 'Hebrew',
    'th-TH': 'Thai',
    'vi-VN': 'Vietnamese',
    'id-ID': 'Indonesian',
    'ms-MY': 'Malay',
    'ro-RO': 'Romanian',
    'uk-UA': 'Ukrainian',
    'bg-BG': 'Bulgarian',
    'hr-HR': 'Croatian',
    'sr-RS': 'Serbian',
    'sk-SK': 'Slovak',
    'sl-SI': 'Slovenian',
    'et-EE': 'Estonian',
    'lv-LV': 'Latvian',
    'lt-LT': 'Lithuanian'
};
// Suspicious phrases that indicate prompt leakage
var SUSPICIOUS_PHRASES = [
    "If there is no speech or only background noise, return an empty string",
    "This is classroom speech from a teacher",
    "Transcribe any audible speech accurately",
    "return an empty string"
];
/**
 * Audio file handler for temporary file operations
 * Following Single Responsibility Principle
 */
var AudioFileHandler = /** @class */ (function () {
    function AudioFileHandler(tempDir) {
        if (tempDir === void 0) { tempDir = TEMP_DIR; }
        this.tempDir = tempDir;
    }
    /**
     * Create a temporary file from an audio buffer
     */
    AudioFileHandler.prototype.createTempFile = function (audioBuffer) {
        return __awaiter(this, void 0, void 0, function () {
            var filePath, fileStats, error_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        filePath = path.join(this.tempDir, "temp-audio-".concat(Date.now(), ".wav"));
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 4, , 5]);
                        return [4 /*yield*/, writeFile(filePath, audioBuffer)];
                    case 2:
                        _a.sent();
                        console.log("Saved audio buffer to temporary file: ".concat(filePath));
                        return [4 /*yield*/, stat(filePath)];
                    case 3:
                        fileStats = _a.sent();
                        console.log("Audio file size: ".concat(fileStats.size, " bytes, created: ").concat(fileStats.mtime));
                        console.log("Audio duration estimate: ~".concat(Math.round(fileStats.size / 16000 / 2), " seconds"));
                        return [2 /*return*/, filePath];
                    case 4:
                        error_1 = _a.sent();
                        console.error('Error creating temporary audio file:', error_1);
                        throw new Error('Failed to create temporary audio file');
                    case 5: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Delete a temporary file
     */
    AudioFileHandler.prototype.deleteTempFile = function (filePath) {
        return __awaiter(this, void 0, void 0, function () {
            var error_2;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, unlink(filePath)];
                    case 1:
                        _a.sent();
                        console.log("Deleted temporary file: ".concat(filePath));
                        return [3 /*break*/, 3];
                    case 2:
                        error_2 = _a.sent();
                        console.error('Error cleaning up temporary file:', error_2);
                        return [3 /*break*/, 3];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    return AudioFileHandler;
}());
/**
 * OpenAI Whisper Transcription Service
 * Handles audio transcription using OpenAI's Whisper API
 */
var OpenAITranscriptionService = /** @class */ (function () {
    function OpenAITranscriptionService(openai, audioHandler) {
        if (audioHandler === void 0) { audioHandler = new AudioFileHandler(); }
        this.openai = openai;
        this.audioHandler = audioHandler;
    }
    /**
     * Transcribe audio using OpenAI Whisper API
     */
    OpenAITranscriptionService.prototype.transcribe = function (audioBuffer, sourceLanguage) {
        return __awaiter(this, void 0, void 0, function () {
            var tempFilePath, audioReadStream, primaryLanguage, transcriptionResponse, originalText_1, isPotentialPromptLeak, error_3, errorMessage;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        // Skip transcription for empty or tiny audio buffers
                        if (!audioBuffer || audioBuffer.length < 1000) {
                            console.log("Audio buffer too small for transcription: ".concat(audioBuffer === null || audioBuffer === void 0 ? void 0 : audioBuffer.length, " bytes"));
                            return [2 /*return*/, ''];
                        }
                        console.log("Transcribing audio buffer of size ".concat(audioBuffer.length, "..."));
                        console.log("Audio buffer header (hex): ".concat(audioBuffer.slice(0, 32).toString('hex')));
                        console.log("Audio buffer has valid WAV header: ".concat(audioBuffer.slice(0, 4).toString() === 'RIFF'));
                        tempFilePath = '';
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 4, 5, 8]);
                        return [4 /*yield*/, this.audioHandler.createTempFile(audioBuffer)];
                    case 2:
                        // Create temporary file from audio buffer
                        tempFilePath = _a.sent();
                        audioReadStream = fs.createReadStream(tempFilePath);
                        console.log('Sending read stream to OpenAI API');
                        // Use minimal parameters to avoid hallucination issues
                        console.log('Using minimal parameters with no prompt to avoid preconceptions');
                        primaryLanguage = sourceLanguage.split('-')[0];
                        return [4 /*yield*/, this.openai.audio.transcriptions.create({
                                file: audioReadStream,
                                model: DEFAULT_WHISPER_MODEL,
                                language: primaryLanguage,
                                response_format: 'json'
                            })];
                    case 3:
                        transcriptionResponse = _a.sent();
                        // Log the full response for debugging
                        console.log("Full transcription response: ".concat(JSON.stringify(transcriptionResponse)));
                        // Use the detected text or empty string if not found
                        if (transcriptionResponse.text) {
                            originalText_1 = transcriptionResponse.text;
                            console.log("Transcription successful: { text: '".concat(originalText_1, "' }"));
                            console.log("\uD83D\uDCE2 DIAGNOSTIC - EXACT TRANSCRIPTION FROM OPENAI: \"".concat(originalText_1, "\""));
                            isPotentialPromptLeak = SUSPICIOUS_PHRASES.some(function (phrase) {
                                return originalText_1.includes(phrase);
                            });
                            if (isPotentialPromptLeak) {
                                console.log('⚠️ DETECTED PROMPT LEAKAGE: The transcription appears to contain prompt instructions');
                                console.log('Treating this as an empty transcription and triggering fallback mechanism');
                                return [2 /*return*/, ''];
                            }
                            return [2 /*return*/, originalText_1];
                        }
                        else {
                            console.log('Transcription returned no text - Whisper API failed to detect speech');
                            return [2 /*return*/, ''];
                        }
                        return [3 /*break*/, 8];
                    case 4:
                        error_3 = _a.sent();
                        console.error('Error during transcription:', error_3);
                        errorMessage = error_3 instanceof Error ? error_3.message : 'Unknown error';
                        throw new Error("Transcription failed: ".concat(errorMessage));
                    case 5:
                        if (!tempFilePath) return [3 /*break*/, 7];
                        return [4 /*yield*/, this.audioHandler.deleteTempFile(tempFilePath)];
                    case 6:
                        _a.sent();
                        _a.label = 7;
                    case 7: return [7 /*endfinally*/];
                    case 8: return [2 /*return*/];
                }
            });
        });
    };
    return OpenAITranscriptionService;
}());
export { OpenAITranscriptionService };
/**
 * OpenAI Translation Service
 * Handles text translation using OpenAI's GPT API
 * Implements proper error handling with retry logic
 */
var OpenAITranslationService = /** @class */ (function () {
    function OpenAITranslationService(openai) {
        this.maxRetries = 3;
        this.openai = openai;
    }
    /**
     * Get the full language name from a language code
     */
    OpenAITranslationService.prototype.getLanguageName = function (languageCode) {
        return LANGUAGE_MAP[languageCode] || languageCode.split('-')[0];
    };
    /**
     * Handle translation errors in a standardized way
     * Extracts useful information from various error types
     */
    OpenAITranslationService.prototype.handleTranslationError = function (error, originalText, retryCount) {
        var errorMessage = 'Unknown error occurred';
        var statusCode = undefined;
        var shouldRetry = retryCount < this.maxRetries;
        // Process different types of errors
        if (error instanceof Error) {
            errorMessage = error.message;
            // Check for specific OpenAI API error patterns
            if ('status' in error && typeof error.status === 'number') {
                statusCode = error.status;
                // Only retry on specific error codes (429 rate limit, 500 server error, etc.)
                var code = statusCode || 0; // Use 0 if undefined
                shouldRetry = retryCount < this.maxRetries &&
                    (code === 429 || code >= 500 || code === 0);
            }
        }
        console.error("Translation error [attempt ".concat(retryCount + 1, "/").concat(this.maxRetries + 1, "]:"), errorMessage);
        return {
            error: errorMessage,
            originalText: originalText,
            retryCount: retryCount,
            statusCode: statusCode,
            shouldRetry: shouldRetry
        };
    };
    /**
     * Create translation request with exponential backoff retry
     */
    OpenAITranslationService.prototype.executeWithRetry = function (text_1, sourceLangName_1, targetLangName_1) {
        return __awaiter(this, arguments, void 0, function (text, sourceLangName, targetLangName, retryCount) {
            var prompt_1, translation, translatedText, error_4, errorResponse, delay_1;
            var _a;
            if (retryCount === void 0) { retryCount = 0; }
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _b.trys.push([0, 2, , 5]);
                        prompt_1 = "\n        Translate this text from ".concat(sourceLangName, " to ").concat(targetLangName, ". \n        Maintain the same tone and style. Return only the translation without explanations or notes.\n        \n        Original text: \"").concat(text, "\"\n        \n        Translation:\n      ");
                        return [4 /*yield*/, this.openai.chat.completions.create({
                                model: DEFAULT_CHAT_MODEL,
                                messages: [
                                    { role: 'system', content: 'You are a professional translator with expertise in multiple languages.' },
                                    { role: 'user', content: prompt_1 }
                                ],
                                temperature: 0.1,
                                max_tokens: 500
                            })];
                    case 1:
                        translation = _b.sent();
                        translatedText = ((_a = translation.choices[0].message.content) === null || _a === void 0 ? void 0 : _a.trim()) || text;
                        return [2 /*return*/, translatedText];
                    case 2:
                        error_4 = _b.sent();
                        errorResponse = this.handleTranslationError(error_4, text, retryCount);
                        if (!errorResponse.shouldRetry) return [3 /*break*/, 4];
                        delay_1 = Math.pow(2, retryCount) * 1000;
                        console.log("Retrying translation in ".concat(delay_1, "ms..."));
                        return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, delay_1); })];
                    case 3:
                        _b.sent();
                        return [2 /*return*/, this.executeWithRetry(text, sourceLangName, targetLangName, retryCount + 1)];
                    case 4: 
                    // If we've exhausted retries or shouldn't retry, throw a standardized error
                    throw new Error("Translation failed after ".concat(retryCount + 1, " attempts: ").concat(errorResponse.error));
                    case 5: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Translate text from one language to another
     * Implementation now has reduced complexity by separating concerns
     */
    OpenAITranslationService.prototype.translate = function (text, sourceLanguage, targetLanguage) {
        return __awaiter(this, void 0, void 0, function () {
            var sourceLangName, targetLangName, translatedText, error_5;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        // Skip translation for empty text
                        if (!text) {
                            return [2 /*return*/, ''];
                        }
                        // If target language is the same as source language, no translation needed
                        if (targetLanguage === sourceLanguage) {
                            console.log("No translation needed - source and target language are the same (".concat(targetLanguage, ")"));
                            return [2 /*return*/, text];
                        }
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        sourceLangName = this.getLanguageName(sourceLanguage);
                        targetLangName = this.getLanguageName(targetLanguage);
                        return [4 /*yield*/, this.executeWithRetry(text, sourceLangName, targetLangName)];
                    case 2:
                        translatedText = _a.sent();
                        console.log("Successfully processed translation to ".concat(targetLanguage));
                        console.log("Translation complete: \"".concat(text, "\" -> \"").concat(translatedText, "\""));
                        return [2 /*return*/, translatedText];
                    case 3:
                        error_5 = _a.sent();
                        console.error("Error translating to ".concat(targetLanguage, ":"), error_5);
                        // For production, we'd log this error to a monitoring system
                        if (error_5 instanceof Error) {
                            console.error("Translation error details: ".concat(error_5.message));
                        }
                        // Return empty string to indicate failure, better than returning misleading text
                        return [2 /*return*/, ''];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    return OpenAITranslationService;
}());
export { OpenAITranslationService };
/**
 * Helper for creating development mode audio buffers
 * Extracted to reduce complexity in main service class
 */
var DevelopmentModeHelper = /** @class */ (function () {
    function DevelopmentModeHelper() {
    }
    /**
     * Create a simple WAV buffer with silence
     * Used for development mode when no real audio processing is available
     */
    DevelopmentModeHelper.createSilentAudioBuffer = function () {
        // Create a minimal PCM WAV header
        var wavHeader = Buffer.from([
            0x52, 0x49, 0x46, 0x46, // "RIFF"
            0x24, 0x00, 0x00, 0x00, // ChunkSize (36 bytes + data size)
            0x57, 0x41, 0x56, 0x45, // "WAVE"
            0x66, 0x6d, 0x74, 0x20, // "fmt "
            0x10, 0x00, 0x00, 0x00, // Subchunk1Size (16 bytes)
            0x01, 0x00, // AudioFormat (1 = PCM)
            0x01, 0x00, // NumChannels (1 = mono)
            0x44, 0xac, 0x00, 0x00, // SampleRate (44100 Hz)
            0x88, 0x58, 0x01, 0x00, // ByteRate (SampleRate * NumChannels * BitsPerSample/8)
            0x02, 0x00, // BlockAlign (NumChannels * BitsPerSample/8)
            0x10, 0x00, // BitsPerSample (16 bits)
            0x64, 0x61, 0x74, 0x61, // "data"
            0x00, 0x00, 0x00, 0x00 // Subchunk2Size (data size)
        ]);
        // Add some silence (1 second)
        var sampleCount = 44100;
        var dataSize = sampleCount * 2; // 16-bit samples
        var silenceData = Buffer.alloc(dataSize);
        // Update the data chunk size in the header
        wavHeader.writeUInt32LE(dataSize, 40);
        // Update the overall file size in the header
        wavHeader.writeUInt32LE(36 + dataSize, 4);
        // Combine header and data
        return Buffer.concat([wavHeader, silenceData]);
    };
    /**
     * Get a synthetic translation based on target language
     */
    DevelopmentModeHelper.getLanguageSpecificTranslation = function (text, targetLanguage) {
        // Simple mapping for common languages in development mode
        var devTranslations = {
            es: 'Esto es una traducción en modo de desarrollo.',
            fr: 'Ceci est une traduction en mode développement.',
            de: 'Dies ist eine Übersetzung im Entwicklungsmodus.',
        };
        // Extract language code without region (e.g., 'es' from 'es-ES')
        var langPrefix = targetLanguage.split('-')[0].toLowerCase();
        // Return mapped translation or original text if no mapping exists
        return devTranslations[langPrefix] || text;
    };
    return DevelopmentModeHelper;
}());
/**
 * Composite Speech Translation Service
 * Orchestrates the entire translation workflow
 * Following the Facade pattern and Strategy pattern to simplify the API
 */
var SpeechTranslationService = /** @class */ (function () {
    function SpeechTranslationService(transcriptionService, translationService, apiKeyAvailable) {
        this.transcriptionService = transcriptionService;
        this.translationService = translationService;
        this.apiKeyAvailable = apiKeyAvailable;
    }
    /**
     * Create development mode synthetic translation for testing without API key
     */
    SpeechTranslationService.prototype.createDevelopmentModeTranslation = function (sourceLanguage, targetLanguage, preTranscribedText) {
        console.log('DEV MODE: Using synthetic translation data due to missing API key');
        // Get the transcription from WebSpeech API if available
        var originalText = preTranscribedText || 'This is a development mode transcription.';
        // Get language-specific translation
        var translatedText = DevelopmentModeHelper.getLanguageSpecificTranslation(originalText, targetLanguage);
        // Create a simple audio buffer with silence
        var audioBuffer = DevelopmentModeHelper.createSilentAudioBuffer();
        console.log("DEV MODE: Returning synthetic translation: \"".concat(translatedText, "\""));
        return {
            originalText: originalText,
            translatedText: translatedText,
            audioBuffer: audioBuffer
        };
    };
    /**
     * Get text either from pre-transcribed input or by transcribing audio
     * Extracted to reduce complexity
     */
    SpeechTranslationService.prototype.getOriginalText = function (audioBuffer, sourceLanguage, preTranscribedText) {
        return __awaiter(this, void 0, void 0, function () {
            var error_6;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        // If text is already provided, skip transcription step
                        if (preTranscribedText) {
                            console.log("Using pre-transcribed text instead of audio: \"".concat(preTranscribedText, "\""));
                            return [2 /*return*/, preTranscribedText];
                        }
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, this.transcriptionService.transcribe(audioBuffer, sourceLanguage)];
                    case 2: return [2 /*return*/, _a.sent()];
                    case 3:
                        error_6 = _a.sent();
                        console.error('Transcription service failed:', error_6);
                        return [2 /*return*/, ''];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Translate text to target language
     * Extracted to reduce complexity
     */
    SpeechTranslationService.prototype.translateText = function (text, sourceLanguage, targetLanguage) {
        return __awaiter(this, void 0, void 0, function () {
            var error_7;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, this.translationService.translate(text, sourceLanguage, targetLanguage)];
                    case 1: return [2 /*return*/, _a.sent()];
                    case 2:
                        error_7 = _a.sent();
                        console.error('Translation service failed:', error_7);
                        return [2 /*return*/, ''];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Transcribe and translate speech
     * Main public method that orchestrates the workflow
     * Now includes emotional tone preservation in synthesized speech
     */
    SpeechTranslationService.prototype.translateSpeech = function (audioBuffer, sourceLanguage, targetLanguage, preTranscribedText, options) {
        return __awaiter(this, void 0, void 0, function () {
            var originalText, translatedText, translatedAudioBuffer, ttsServiceType, ttsService, error_8;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        console.log("Processing speech translation from ".concat(sourceLanguage, " to ").concat(targetLanguage));
                        // DEVELOPMENT MODE: Check if API key is missing
                        if (!this.apiKeyAvailable) {
                            return [2 /*return*/, this.createDevelopmentModeTranslation(sourceLanguage, targetLanguage, preTranscribedText)];
                        }
                        return [4 /*yield*/, this.getOriginalText(audioBuffer, sourceLanguage, preTranscribedText)];
                    case 1:
                        originalText = _a.sent();
                        // Skip empty transcriptions
                        if (!originalText) {
                            return [2 /*return*/, {
                                    originalText: '',
                                    translatedText: '',
                                    audioBuffer: audioBuffer
                                }];
                        }
                        return [4 /*yield*/, this.translateText(originalText, sourceLanguage, targetLanguage)];
                    case 2:
                        translatedText = _a.sent();
                        translatedAudioBuffer = audioBuffer;
                        _a.label = 3;
                    case 3:
                        _a.trys.push([3, 5, , 6]);
                        ttsServiceType = (options && options.ttsServiceType) || process.env.TTS_SERVICE_TYPE || 'browser';
                        // Log the TTS service being used
                        console.log("Using TTS service '".concat(ttsServiceType, "' for language '").concat(targetLanguage, "'"));
                        ttsService = ttsFactory.getService(ttsServiceType);
                        return [4 /*yield*/, ttsService.synthesizeSpeech({
                                text: translatedText || originalText,
                                languageCode: targetLanguage,
                                preserveEmotions: true // Enable emotional tone preservation
                            })];
                    case 4:
                        // Use the selected TTS service to generate audio with emotion preservation
                        translatedAudioBuffer = _a.sent();
                        console.log("Generated translated audio using ".concat(ttsServiceType, " service: ").concat(translatedAudioBuffer.length, " bytes"));
                        return [3 /*break*/, 6];
                    case 5:
                        error_8 = _a.sent();
                        console.error('Error generating audio for translation:', error_8);
                        return [3 /*break*/, 6];
                    case 6: return [2 /*return*/, {
                            originalText: originalText,
                            translatedText: translatedText || originalText, // Fallback to original text if translation failed
                            audioBuffer: translatedAudioBuffer
                        }];
                }
            });
        });
    };
    return SpeechTranslationService;
}());
export { SpeechTranslationService };
// Replace the problematic OpenAI initialization section (around line 637) with this:
// Initialize OpenAI client with API key from environment
var openai;
try {
    // Check for OpenAI API key
    if (!process.env.OPENAI_API_KEY) {
        console.warn('OpenAI API key status: Missing');
        console.warn('OPENAI_API_KEY is missing or empty. This might cause API failures.');
    }
    else {
        console.log('OpenAI API key status: Present');
    }
    // Initialize OpenAI client
    openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY || 'sk-placeholder-for-initialization-only'
    });
    console.log('OpenAI client initialized successfully');
}
catch (error) {
    console.error('Error initializing OpenAI client:', error);
    // Create a placeholder client that will throw proper errors when methods are called
    openai = new OpenAI({ apiKey: 'sk-placeholder-for-initialization-only' });
}
// Create service instances
var audioHandler = new AudioFileHandler();
var transcriptionService = new OpenAITranscriptionService(openai, audioHandler);
var translationService = new OpenAITranslationService(openai);
// Create and export the main service facade
export var speechTranslationService = new SpeechTranslationService(transcriptionService, translationService, Boolean(process.env.OPENAI_API_KEY));
// Export the legacy function for backward compatibility
export function translateSpeech(audioBuffer, sourceLanguage, targetLanguage, preTranscribedText, ttsServiceType) {
    return __awaiter(this, void 0, void 0, function () {
        var ttsServiceOptions;
        return __generator(this, function (_a) {
            if (typeof ttsServiceType === 'string') {
                ttsServiceOptions = { ttsServiceType: ttsServiceType };
                console.log("Using TTS service '".concat(ttsServiceType, "' (string format)"));
            }
            else {
                ttsServiceOptions = ttsServiceType || {};
                console.log("Using TTS service options:", ttsServiceOptions);
            }
            return [2 /*return*/, speechTranslationService.translateSpeech(audioBuffer, sourceLanguage, targetLanguage, preTranscribedText, ttsServiceOptions)];
        });
    });
}
//# sourceMappingURL=TranslationService.js.map