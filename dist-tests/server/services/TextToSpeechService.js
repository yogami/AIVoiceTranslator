/**
 * Text to Speech Service
 *
 * This service is responsible for generating speech from translated text
 * with preserved emotional tone using OpenAI's Text-to-Speech API.
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
import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import { createHash } from 'crypto';
// Promisify file system operations
var writeFile = promisify(fs.writeFile);
var mkdir = promisify(fs.mkdir);
var readFile = promisify(fs.readFile);
var stat = promisify(fs.stat);
var access = promisify(fs.access);
// Constants for cache directory
var CACHE_DIR = path.join(process.cwd(), 'audio-cache');
var MAX_CACHE_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours
var TEMP_DIR = process.env.TEMP_DIR || path.join(process.cwd(), 'temp');
// Voice options by language and gender
var VOICE_OPTIONS = {
    'en': ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'], // English
    'es': ['nova', 'echo', 'alloy'], // Spanish (using neutral voices)
    'fr': ['alloy', 'nova', 'shimmer'], // French (using neutral voices)
    'de': ['onyx', 'nova', 'shimmer'], // German (using neutral voices)
    'ja': ['nova', 'alloy', 'echo'], // Japanese (using neutral voices)
    'zh': ['alloy', 'nova', 'onyx'], // Chinese (using neutral voices)
    'default': ['nova', 'alloy'] // Default fallback
};
// Emotion detection patterns
var EMOTION_PATTERNS = [
    {
        name: 'excited',
        voiceStyle: 'excited', // Higher pitch, faster pace
        patterns: [
            /\!+/g, // Exclamation marks
            /amazing|fantastic|incredible|awesome|wow|wonderful/gi,
            /😄|😃|😁|🤩|😍|🎉|💯|⚡/g // Excited emojis
        ]
    },
    {
        name: 'serious',
        voiceStyle: 'serious', // Slower, more deliberate pace
        patterns: [
            /important|critical|crucial|serious|warning|caution|beware/gi,
            /⚠️|❗|🚨|🔴|❓/g // Warning/serious emojis
        ]
    },
    {
        name: 'calm',
        voiceStyle: 'calming', // Soft, soothing tone
        patterns: [
            /relax|calm|gentle|peaceful|quiet|softly/gi,
            /😌|🧘|💭|☮️|💫/g // Calm emojis
        ]
    },
    {
        name: 'sad',
        voiceStyle: 'sad', // Lower pitch, slower pace
        patterns: [
            /sad|sorry|unfortunately|regret|disappointed/gi,
            /😢|😥|😔|😞|💔/g // Sad emojis
        ]
    }
];
/**
 * Browser Speech Synthesis Service
 * This service doesn't actually generate audio data on the server.
 * It returns an empty buffer and signals the client to use browser's SpeechSynthesis API.
 */
var BrowserSpeechSynthesisService = /** @class */ (function () {
    function BrowserSpeechSynthesisService() {
    }
    /**
     * Instead of generating audio on the server, returns a special marker buffer
     * The client will recognize this marker and use the browser's SpeechSynthesis API
     */
    BrowserSpeechSynthesisService.prototype.synthesizeSpeech = function (options) {
        return __awaiter(this, void 0, void 0, function () {
            var markerText;
            return __generator(this, function (_a) {
                console.log("Using browser speech synthesis for text (".concat(options.text.length, " chars) in ").concat(options.languageCode));
                markerText = JSON.stringify({
                    type: 'browser-speech',
                    text: options.text,
                    languageCode: options.languageCode,
                    preserveEmotions: options.preserveEmotions,
                    speed: options.speed || 1.0,
                    autoPlay: true // Enable automatic playback to match OpenAI behavior
                });
                // Return the marker as a buffer
                return [2 /*return*/, Buffer.from(markerText)];
            });
        });
    };
    return BrowserSpeechSynthesisService;
}());
export { BrowserSpeechSynthesisService };
/**
 * Silent Text to Speech Service
 * This is a fallback service that just returns an empty audio buffer
 * Useful for debugging or when no audio output is desired
 */
var SilentTextToSpeechService = /** @class */ (function () {
    function SilentTextToSpeechService() {
    }
    SilentTextToSpeechService.prototype.synthesizeSpeech = function (_options) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                console.log('Using silent (no audio) TTS service');
                // Return an empty buffer - no audio will be played
                return [2 /*return*/, Buffer.from([])];
            });
        });
    };
    return SilentTextToSpeechService;
}());
export { SilentTextToSpeechService };
/**
 * OpenAI Text to Speech Service
 * Handles text-to-speech conversion using OpenAI's TTS API
 */
var OpenAITextToSpeechService = /** @class */ (function () {
    function OpenAITextToSpeechService(openai) {
        this.openai = openai;
        this.ensureCacheDirectoryExists();
    }
    /**
     * Ensure cache directory exists
     */
    OpenAITextToSpeechService.prototype.ensureCacheDirectoryExists = function () {
        return __awaiter(this, void 0, void 0, function () {
            var error_1, mkdirError_1, error_2, mkdirError_2;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 7]);
                        return [4 /*yield*/, access(CACHE_DIR, fs.constants.F_OK)];
                    case 1:
                        _a.sent();
                        return [3 /*break*/, 7];
                    case 2:
                        error_1 = _a.sent();
                        _a.label = 3;
                    case 3:
                        _a.trys.push([3, 5, , 6]);
                        return [4 /*yield*/, mkdir(CACHE_DIR, { recursive: true })];
                    case 4:
                        _a.sent();
                        console.log("Created audio cache directory: ".concat(CACHE_DIR));
                        return [3 /*break*/, 6];
                    case 5:
                        mkdirError_1 = _a.sent();
                        console.error('Error creating audio cache directory:', mkdirError_1);
                        return [3 /*break*/, 6];
                    case 6: return [3 /*break*/, 7];
                    case 7:
                        _a.trys.push([7, 9, , 14]);
                        return [4 /*yield*/, access(TEMP_DIR, fs.constants.F_OK)];
                    case 8:
                        _a.sent();
                        return [3 /*break*/, 14];
                    case 9:
                        error_2 = _a.sent();
                        _a.label = 10;
                    case 10:
                        _a.trys.push([10, 12, , 13]);
                        return [4 /*yield*/, mkdir(TEMP_DIR, { recursive: true })];
                    case 11:
                        _a.sent();
                        console.log("Created temp directory: ".concat(TEMP_DIR));
                        return [3 /*break*/, 13];
                    case 12:
                        mkdirError_2 = _a.sent();
                        console.error('Error creating temp directory:', mkdirError_2);
                        return [3 /*break*/, 13];
                    case 13: return [3 /*break*/, 14];
                    case 14: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Generate cache key for a TTS request
     */
    OpenAITextToSpeechService.prototype.generateCacheKey = function (options) {
        var dataToHash = JSON.stringify({
            text: options.text,
            languageCode: options.languageCode,
            voice: options.voice,
            speed: options.speed,
            preserveEmotions: options.preserveEmotions
        });
        return createHash('md5').update(dataToHash).digest('hex');
    };
    /**
     * Check if cached audio exists and is valid
     */
    OpenAITextToSpeechService.prototype.getCachedAudio = function (cacheKey) {
        return __awaiter(this, void 0, void 0, function () {
            var cachePath, fileStats, fileAgeMs, error_3;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        cachePath = path.join(CACHE_DIR, "".concat(cacheKey, ".mp3"));
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 7, , 8]);
                        // Check if file exists
                        return [4 /*yield*/, access(cachePath, fs.constants.F_OK)];
                    case 2:
                        // Check if file exists
                        _a.sent();
                        return [4 /*yield*/, stat(cachePath)];
                    case 3:
                        fileStats = _a.sent();
                        fileAgeMs = Date.now() - fileStats.mtimeMs;
                        if (!(fileAgeMs < MAX_CACHE_AGE_MS)) return [3 /*break*/, 5];
                        console.log("Using cached audio: ".concat(cachePath));
                        return [4 /*yield*/, readFile(cachePath)];
                    case 4: return [2 /*return*/, _a.sent()];
                    case 5:
                        console.log("Cache expired for: ".concat(cachePath));
                        return [2 /*return*/, null];
                    case 6: return [3 /*break*/, 8];
                    case 7:
                        error_3 = _a.sent();
                        // File doesn't exist or can't be accessed
                        return [2 /*return*/, null];
                    case 8: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Save audio to cache
     */
    OpenAITextToSpeechService.prototype.cacheAudio = function (cacheKey, audioBuffer) {
        return __awaiter(this, void 0, void 0, function () {
            var cachePath, error_4;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        cachePath = path.join(CACHE_DIR, "".concat(cacheKey, ".mp3"));
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, writeFile(cachePath, audioBuffer)];
                    case 2:
                        _a.sent();
                        console.log("Cached audio to: ".concat(cachePath));
                        return [3 /*break*/, 4];
                    case 3:
                        error_4 = _a.sent();
                        console.error('Error caching audio:', error_4);
                        return [3 /*break*/, 4];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Detect emotions in text
     */
    OpenAITextToSpeechService.prototype.detectEmotions = function (text) {
        var detectedEmotions = [];
        // Check for each emotion pattern
        EMOTION_PATTERNS.forEach(function (emotionPattern) {
            var matchCount = 0;
            var totalMatches = 0;
            // Check each pattern for this emotion
            emotionPattern.patterns.forEach(function (pattern) {
                var matches = text.match(pattern);
                if (matches && matches.length > 0) {
                    matchCount++;
                    totalMatches += matches.length;
                }
            });
            // Calculate confidence - based on how many different patterns matched
            if (matchCount > 0) {
                var patternRatio = matchCount / emotionPattern.patterns.length;
                var textLength = text.length;
                // Normalized confidence (0-1) with some smoothing based on text length
                var confidence = Math.min(0.3 + (patternRatio * 0.5) + (totalMatches / textLength) * 20, 1);
                detectedEmotions.push({
                    emotion: emotionPattern.name,
                    confidence: confidence
                });
            }
        });
        // Sort by confidence (descending)
        return detectedEmotions.sort(function (a, b) { return b.confidence - a.confidence; });
    };
    /**
     * Select appropriate voice for language and emotion
     */
    OpenAITextToSpeechService.prototype.selectVoice = function (languageCode, detectedEmotion) {
        // Extract base language code (e.g., 'en' from 'en-US')
        var baseLanguage = languageCode.split('-')[0].toLowerCase();
        // Get available voices for this language
        var availableVoices = VOICE_OPTIONS[baseLanguage] || VOICE_OPTIONS.default;
        // Simple voice selection logic - can be extended
        if (detectedEmotion === 'excited') {
            // For excited: prefer echo or alloy
            return availableVoices.includes('echo') ? 'echo' : availableVoices[0];
        }
        else if (detectedEmotion === 'serious') {
            // For serious: prefer onyx
            return availableVoices.includes('onyx') ? 'onyx' : availableVoices[0];
        }
        else if (detectedEmotion === 'calm') {
            // For calm: prefer nova
            return availableVoices.includes('nova') ? 'nova' : availableVoices[0];
        }
        else if (detectedEmotion === 'sad') {
            // For sad: prefer shimmer
            return availableVoices.includes('shimmer') ? 'shimmer' : availableVoices[0];
        }
        // Default to first available voice
        return availableVoices[0];
    };
    /**
     * Adjust speech parameters based on detected emotion
     */
    OpenAITextToSpeechService.prototype.adjustSpeechParams = function (emotion, options) {
        var voice = options.voice || this.selectVoice(options.languageCode, emotion);
        var speed = options.speed || 1.0;
        var input = options.text;
        // Adjust parameters based on emotion
        switch (emotion) {
            case 'excited':
                speed = Math.min(speed * 1.2, 1.75); // Faster for excitement
                // Add SSML markup for emphasis - not used in OpenAI TTS directly but in prompt preparation
                input = options.text.replace(/(!+|\bwow\b|\bamazing\b|\bincredible\b|\bawesome\b)/gi, function (match) { return match.toUpperCase(); });
                break;
            case 'serious':
                speed = Math.max(speed * 0.9, 0.7); // Slower for seriousness
                // Add more spacing between important words
                input = options.text.replace(/(\bimportant\b|\bcritical\b|\bcrucial\b|\bserious\b|\bwarning\b)/gi, function (match) { return ". ".concat(match.toUpperCase(), " ."); });
                break;
            case 'calm':
                speed = Math.max(speed * 0.85, 0.7); // Slower for calmness
                break;
            case 'sad':
                speed = Math.max(speed * 0.8, 0.7); // Slower for sadness
                break;
            default:
                // No modifications for default
                break;
        }
        return { voice: voice, speed: speed, input: input };
    };
    /**
     * Format input text with SSML (Speech Synthesis Markup Language)
     * Note: OpenAI TTS doesn't support SSML directly but we can use text formatting
     * to better convey mood to the model
     */
    OpenAITextToSpeechService.prototype.formatInputForEmotion = function (text, emotion) {
        // Basic formatting based on emotion
        switch (emotion) {
            case 'excited':
                return text.replace(/\!/g, '!!').replace(/\./g, '! ');
            case 'serious':
                return text.replace(/(\w+)/g, function (match) {
                    if (match.length > 4 && Math.random() > 0.7) {
                        return match.toUpperCase();
                    }
                    return match;
                });
            case 'calm':
                return text.replace(/\./g, '... ').replace(/\!/g, '.');
            case 'sad':
                return text.replace(/\./g, '... ').replace(/\!/g, '...');
            default:
                return text;
        }
    };
    /**
     * Synthesize speech from text using OpenAI's TTS API
     */
    OpenAITextToSpeechService.prototype.synthesizeSpeech = function (options) {
        return __awaiter(this, void 0, void 0, function () {
            var cacheKey, cachedAudio, voice, speed, input, detectedEmotions, topEmotion, adjustedParams, outputFilePath, mp3, buffer, _a, _b, error_5;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        cacheKey = this.generateCacheKey(options);
                        return [4 /*yield*/, this.getCachedAudio(cacheKey)];
                    case 1:
                        cachedAudio = _c.sent();
                        if (cachedAudio) {
                            return [2 /*return*/, cachedAudio];
                        }
                        _c.label = 2;
                    case 2:
                        _c.trys.push([2, 7, , 8]);
                        console.log("Synthesizing speech for text (".concat(options.text.length, " chars) in ").concat(options.languageCode));
                        voice = options.voice || this.selectVoice(options.languageCode);
                        speed = options.speed || 1.0;
                        input = options.text;
                        // If emotion preservation is requested
                        if (options.preserveEmotions) {
                            detectedEmotions = this.detectEmotions(options.text);
                            if (detectedEmotions.length > 0) {
                                topEmotion = detectedEmotions[0];
                                console.log("Detected emotion: ".concat(topEmotion.emotion, " (confidence: ").concat(topEmotion.confidence.toFixed(2), ")"));
                                adjustedParams = this.adjustSpeechParams(topEmotion.emotion, options);
                                voice = adjustedParams.voice;
                                speed = adjustedParams.speed;
                                // Format input for emotion if confidence is high enough
                                if (topEmotion.confidence > 0.5) {
                                    input = this.formatInputForEmotion(adjustedParams.input, topEmotion.emotion);
                                }
                                else {
                                    input = adjustedParams.input;
                                }
                            }
                        }
                        outputFilePath = path.join(TEMP_DIR, "tts-".concat(Date.now(), ".mp3"));
                        // Create speech using OpenAI's API
                        console.log("Using voice: ".concat(voice, ", speed: ").concat(speed));
                        return [4 /*yield*/, this.openai.audio.speech.create({
                                model: "tts-1", // Basic model, use tts-1-hd for higher quality
                                voice: voice,
                                input: input,
                                speed: speed,
                                response_format: "mp3",
                            })];
                    case 3:
                        mp3 = _c.sent();
                        _b = (_a = Buffer).from;
                        return [4 /*yield*/, mp3.arrayBuffer()];
                    case 4:
                        buffer = _b.apply(_a, [_c.sent()]);
                        // Save to file (optional - for debugging)
                        return [4 /*yield*/, writeFile(outputFilePath, buffer)];
                    case 5:
                        // Save to file (optional - for debugging)
                        _c.sent();
                        console.log("Saved synthesized speech to: ".concat(outputFilePath));
                        // Cache the result for future use
                        return [4 /*yield*/, this.cacheAudio(cacheKey, buffer)];
                    case 6:
                        // Cache the result for future use
                        _c.sent();
                        return [2 /*return*/, buffer];
                    case 7:
                        error_5 = _c.sent();
                        console.error('Error synthesizing speech:', error_5);
                        throw new Error("Speech synthesis failed: ".concat(error_5 instanceof Error ? error_5.message : 'Unknown error'));
                    case 8: return [2 /*return*/];
                }
            });
        });
    };
    return OpenAITextToSpeechService;
}());
export { OpenAITextToSpeechService };
/**
 * Text to Speech Factory class
 * Creates and provides different text-to-speech service implementations
 */
var TextToSpeechFactory = /** @class */ (function () {
    function TextToSpeechFactory() {
        this.services = new Map();
        // Initialize OpenAI client with API key from environment
        var apiKey = process.env.OPENAI_API_KEY || '';
        try {
            this.openai = new OpenAI({
                apiKey: apiKey || 'sk-placeholder-for-initialization-only'
            });
            console.log('OpenAI client initialized for TTS service');
        }
        catch (error) {
            console.error('Error initializing OpenAI client for TTS:', error);
            this.openai = new OpenAI({ apiKey: 'sk-placeholder-for-initialization-only' });
        }
        // Register services
        this.services.set('openai', new OpenAITextToSpeechService(this.openai));
        this.services.set('browser', new BrowserSpeechSynthesisService());
        this.services.set('silent', new SilentTextToSpeechService());
    }
    TextToSpeechFactory.getInstance = function () {
        if (!TextToSpeechFactory.instance) {
            TextToSpeechFactory.instance = new TextToSpeechFactory();
        }
        return TextToSpeechFactory.instance;
    };
    TextToSpeechFactory.prototype.getService = function (serviceType) {
        if (serviceType === void 0) { serviceType = 'openai'; }
        var service = this.services.get(serviceType.toLowerCase());
        if (!service) {
            console.warn("TTS service '".concat(serviceType, "' not found, falling back to openai"));
            return this.services.get('openai');
        }
        return service;
    };
    return TextToSpeechFactory;
}());
export { TextToSpeechFactory };
// Export factory instance for getting TTS services
export var ttsFactory = TextToSpeechFactory.getInstance();
// Export a convenience function to get the default TTS service (backward compatibility)
export var textToSpeechService = {
    synthesizeSpeech: function (options) { return __awaiter(void 0, void 0, void 0, function () {
        var serviceType;
        return __generator(this, function (_a) {
            serviceType = process.env.TTS_SERVICE_TYPE || 'openai';
            return [2 /*return*/, ttsFactory.getService(serviceType).synthesizeSpeech(options)];
        });
    }); }
};
//# sourceMappingURL=TextToSpeechService.js.map