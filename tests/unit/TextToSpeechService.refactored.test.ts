/**
 * Refactored TextToSpeechService Unit Tests
 * 
 * These tests verify the behavior of the refactored TextToSpeechService
 * implementation and its components following SOLID principles.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import {
  TextToSpeechFactory,
  ITextToSpeechService,
  TextToSpeechOptions,
  OpenAITextToSpeechService,
  BrowserSpeechSynthesisService,
  SilentTextToSpeechService,
  IFileSystem,
  TTSCacheManager,
  EmotionDetector,
  VoiceSelector,
  OpenAITTSApiProvider,
  TTSErrorHandler,
  ICacheManager,
  IEmotionProcessor,
  IVoiceSelector,
  ITTSApiProvider,
  IErrorHandler
} from '../../server/services/TextToSpeechService.refactored';

// Mock dependencies
class MockFileSystem implements IFileSystem {
  ensureDirectoryExists = jest.fn().mockResolvedValue(undefined);
  writeFile = jest.fn().mockResolvedValue(undefined);
  fileExists = jest.fn().mockResolvedValue(false);
  readFile = jest.fn().mockResolvedValue(Buffer.from('mock audio data'));
}

class MockCacheManager implements ICacheManager {
  ensureCacheDirectories = jest.fn().mockResolvedValue(undefined);
  generateCacheKey = jest.fn().mockReturnValue('mock-cache-key');
  getCachedAudio = jest.fn().mockResolvedValue(null);
  cacheAudio = jest.fn().mockResolvedValue(undefined);
  saveToTemporaryFile = jest.fn().mockResolvedValue(undefined);
}

class MockEmotionProcessor implements IEmotionProcessor {
  detectEmotions = jest.fn().mockReturnValue([{emotion: 'happy', confidence: 0.9}]);
  adjustSpeechParams = jest.fn().mockImplementation((emotion, options) => ({
    voice: options.voice || 'nova',
    speed: options.speed || 1.0,
    input: options.text
  }));
  formatInputForEmotion = jest.fn().mockImplementation((text, emotion) => text);
}

class MockVoiceSelector implements IVoiceSelector {
  selectVoiceForLanguage = jest.fn().mockReturnValue('nova');
}

class MockTTSApiProvider implements ITTSApiProvider {
  createSpeech = jest.fn().mockResolvedValue(Buffer.from('mock audio data'));
}

class MockErrorHandler implements IErrorHandler {
  handleSynthesisError = jest.fn().mockReturnValue(Buffer.from('error audio'));
}

describe('Refactored TextToSpeechService', () => {
  let fileSystem: MockFileSystem;
  let cacheManager: MockCacheManager;
  let emotionProcessor: MockEmotionProcessor;
  let voiceSelector: MockVoiceSelector;
  let apiProvider: MockTTSApiProvider;
  let errorHandler: MockErrorHandler;
  let openAITTSService: OpenAITextToSpeechService;
  let ttsFactory: TextToSpeechFactory;
  
  beforeEach(() => {
    // Create fresh mocks for each test
    fileSystem = new MockFileSystem();
    cacheManager = new MockCacheManager();
    emotionProcessor = new MockEmotionProcessor();
    voiceSelector = new MockVoiceSelector();
    apiProvider = new MockTTSApiProvider();
    errorHandler = new MockErrorHandler();
    
    // Create TTS service with mocked dependencies
    openAITTSService = new OpenAITextToSpeechService(
      cacheManager,
      emotionProcessor,
      voiceSelector,
      apiProvider,
      errorHandler
    );
    
    // Mock browser speech synthesis service - we can't easily test this in Node.js
    const mockBrowserService = {
      synthesizeSpeech: jest.fn().mockResolvedValue(Buffer.from('browser tts audio'))
    } as unknown as BrowserSpeechSynthesisService;
    
    // Create factory with our services
    ttsFactory = new TextToSpeechFactory(
      openAITTSService,
      mockBrowserService as BrowserSpeechSynthesisService,
      new SilentTextToSpeechService()
    );
  });
  
  describe('TextToSpeechFactory', () => {
    it('should create OpenAI TTS service when requested', () => {
      const service = ttsFactory.createTTSService('openai');
      expect(service).toBe(openAITTSService);
    });
    
    it('should create silent TTS service when requested', () => {
      const service = ttsFactory.createTTSService('silent');
      expect(service).toBeInstanceOf(SilentTextToSpeechService);
    });
    
    it('should default to OpenAI service for unknown service types', () => {
      const service = ttsFactory.createTTSService('unknown');
      expect(service).toBe(openAITTSService);
    });
  });
  
  describe('OpenAITextToSpeechService', () => {
    it('should check cache before generating speech', async () => {
      const options: TextToSpeechOptions = {
        text: 'Hello world',
        languageCode: 'en',
        preserveEmotions: true
      };
      
      await openAITTSService.synthesizeSpeech(options);
      
      expect(cacheManager.ensureCacheDirectories).toHaveBeenCalled();
      expect(cacheManager.generateCacheKey).toHaveBeenCalledWith(options);
      expect(cacheManager.getCachedAudio).toHaveBeenCalledWith('mock-cache-key');
    });
    
    it('should return cached audio when available', async () => {
      // Setup cache hit scenario
      const cachedAudio = Buffer.from('cached audio data');
      cacheManager.getCachedAudio = jest.fn().mockResolvedValue(cachedAudio);
      
      const options: TextToSpeechOptions = {
        text: 'Hello world',
        languageCode: 'en'
      };
      
      const result = await openAITTSService.synthesizeSpeech(options);
      
      expect(result).toBe(cachedAudio);
      expect(apiProvider.createSpeech).not.toHaveBeenCalled();
    });
    
    it('should generate speech when not in cache', async () => {
      // Setup cache miss scenario
      cacheManager.getCachedAudio = jest.fn().mockResolvedValue(null);
      
      const options: TextToSpeechOptions = {
        text: 'Hello world',
        languageCode: 'en',
        preserveEmotions: false
      };
      
      await openAITTSService.synthesizeSpeech(options);
      
      expect(apiProvider.createSpeech).toHaveBeenCalled();
      expect(cacheManager.cacheAudio).toHaveBeenCalled();
    });
    
    it('should process emotions when preserveEmotions is true', async () => {
      // Setup cache miss scenario
      cacheManager.getCachedAudio = jest.fn().mockResolvedValue(null);
      
      const options: TextToSpeechOptions = {
        text: 'Hello world',
        languageCode: 'en',
        preserveEmotions: true
      };
      
      await openAITTSService.synthesizeSpeech(options);
      
      expect(emotionProcessor.detectEmotions).toHaveBeenCalledWith('Hello world');
      expect(emotionProcessor.adjustSpeechParams).toHaveBeenCalled();
      expect(emotionProcessor.formatInputForEmotion).toHaveBeenCalled();
    });
    
    it('should handle errors gracefully', async () => {
      // Setup error scenario
      apiProvider.createSpeech = jest.fn().mockRejectedValue(new Error('API error'));
      
      const options: TextToSpeechOptions = {
        text: 'Hello world',
        languageCode: 'en'
      };
      
      await openAITTSService.synthesizeSpeech(options);
      
      expect(errorHandler.handleSynthesisError).toHaveBeenCalled();
    });
  });
  
  describe('SilentTextToSpeechService', () => {
    it('should return an empty buffer', async () => {
      const silentService = new SilentTextToSpeechService();
      
      const result = await silentService.synthesizeSpeech({
        text: 'Hello world',
        languageCode: 'en'
      });
      
      expect(Buffer.isBuffer(result)).toBe(true);
      expect(result.length).toBe(0);
    });
  });
});
