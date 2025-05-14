/**
 * Minimal TextToSpeechService Tests
 * 
 * This file uses a simpler approach to testing the TextToSpeechService module
 * directly mocking the functions we use rather than whole modules.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Directly mock the functions we need from modules
vi.stubGlobal('fs', {
  constants: { F_OK: 0 },
  existsSync: vi.fn().mockReturnValue(true),
  createReadStream: vi.fn().mockReturnValue({}),
  writeFile: vi.fn(),
  readFile: vi.fn(),
  access: vi.fn(),
  mkdir: vi.fn(),
  stat: vi.fn()
});

vi.stubGlobal('fs/promises', {
  writeFile: vi.fn().mockResolvedValue(undefined),
  readFile: vi.fn().mockImplementation((path) => {
    if (path.includes('exists')) {
      return Promise.resolve(Buffer.from('mock cached audio'));
    }
    return Promise.reject(new Error('ENOENT'));
  }),
  access: vi.fn().mockImplementation((path) => {
    if (path.includes('exists') || path.includes('audio-cache') || path.includes('temp')) {
      return Promise.resolve();
    }
    return Promise.reject(new Error('ENOENT'));
  }),
  mkdir: vi.fn().mockResolvedValue(undefined),
  stat: vi.fn().mockImplementation((path) => {
    if (path.includes('expired')) {
      return Promise.resolve({ mtimeMs: Date.now() - (25 * 60 * 60 * 1000) });
    }
    return Promise.resolve({ mtimeMs: Date.now() - 1000 });
  })
});

vi.stubGlobal('path', {
  join: vi.fn((...args) => args.join('/')),
  dirname: vi.fn((p) => p.substring(0, p.lastIndexOf('/') || 0)),
  resolve: vi.fn((...args) => args.join('/'))
});

vi.stubGlobal('crypto', {
  createHash: vi.fn(() => ({
    update: vi.fn().mockReturnThis(),
    digest: vi.fn().mockReturnValue('mock-hash')
  }))
});

vi.stubGlobal('util', {
  promisify: vi.fn((fn) => {
    return (...args) => Promise.resolve(Buffer.from('mock promisified data'));
  })
});

// Set environment variables
vi.stubEnv('OPENAI_API_KEY', 'mock-api-key');

// IMPORTANT: We're NOT attempting to mock the OpenAI module directly
// Instead, we're mocking the necessary file system operations and testing functions
// that don't require a working OpenAI client

// Mock fs promises functions
vi.mock('fs/promises', () => ({
  readFile: vi.fn().mockRejectedValue(new Error('File not found')),
  writeFile: vi.fn().mockResolvedValue(undefined),
  mkdir: vi.fn().mockResolvedValue(undefined),
  stat: vi.fn().mockResolvedValue({ mtimeMs: Date.now() }),
  access: vi.fn().mockRejectedValue(new Error('No access'))
}));

describe('TextToSpeechService Core Tests', () => {
  let ttsModule: any;
  
  // Import the module fresh for each test
  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    
    // Directly import the classes we want to test
    try {
      ttsModule = await import('../../../server/services/TextToSpeechService');
    } catch (error) {
      console.error('Error importing TextToSpeechService:', error);
      throw error;
    }
  });
  
  afterEach(() => {
    vi.restoreAllMocks();
  });
  
  describe('SilentTextToSpeechService', () => {
    it('should exist in the module', () => {
      expect(ttsModule.SilentTextToSpeechService).toBeDefined();
    });
    
    it('should return an empty buffer from synthesizeSpeech', async () => {
      const silentTTS = new ttsModule.SilentTextToSpeechService();
      
      const result = await silentTTS.synthesizeSpeech({ 
        text: 'Hello', 
        languageCode: 'en-US' 
      });
      
      expect(Buffer.isBuffer(result)).toBe(true);
      expect(result.length).toBe(0);
    });
  });
  
  describe('BrowserSpeechSynthesisService', () => {
    it('should return a JSON marker with speech info', async () => {
      const browserTTS = new ttsModule.BrowserSpeechSynthesisService();
      
      const result = await browserTTS.synthesizeSpeech({
        text: 'Browser speech test',
        languageCode: 'en-US',
        preserveEmotions: true,
        speed: 1.2
      });
      
      expect(Buffer.isBuffer(result)).toBe(true);
      
      // It should contain JSON data
      const jsonData = JSON.parse(result.toString());
      expect(jsonData.type).toBe('browser-speech');
      expect(jsonData.text).toBe('Browser speech test');
      expect(jsonData.preserveEmotions).toBe(true);
      expect(jsonData.speed).toBe(1.2);
    });
    
    it('should use default speed when not provided', async () => {
      const browserTTS = new ttsModule.BrowserSpeechSynthesisService();
      
      const result = await browserTTS.synthesizeSpeech({
        text: 'Default speed test',
        languageCode: 'en-US'
      });
      
      const jsonData = JSON.parse(result.toString());
      expect(jsonData.speed).toBe(1.0);
    });
  });
  
  describe('TextToSpeechFactory', () => {
    it('should be implemented as a singleton', () => {
      expect(ttsModule.ttsFactory).toBeDefined();
      expect(ttsModule.ttsFactory).toBe(ttsModule.TextToSpeechFactory.getInstance());
    });
    
    it('should create different service types', () => {
      const silentService = ttsModule.ttsFactory.getService('silent');
      expect(silentService).toBeInstanceOf(ttsModule.SilentTextToSpeechService);
      
      const browserService = ttsModule.ttsFactory.getService('browser');
      expect(browserService).toBeInstanceOf(ttsModule.BrowserSpeechSynthesisService);
      
      const openaiService = ttsModule.ttsFactory.getService('openai');
      expect(openaiService).toBeInstanceOf(ttsModule.OpenAITextToSpeechService);
    });
    
    it('should return openai service as default for unknown type', () => {
      const defaultService = ttsModule.ttsFactory.getService('unknown');
      expect(defaultService).toBeInstanceOf(ttsModule.OpenAITextToSpeechService);
    });
    
    it('should return the same instance for the same service type', () => {
      const service1 = ttsModule.ttsFactory.getService('browser');
      const service2 = ttsModule.ttsFactory.getService('browser');
      expect(service1).toBe(service2);
    });
  });
  
  describe('OpenAITextToSpeechService', () => {
    // Create a proper test double for the OpenAI API
    class OpenAITestDouble {
      audio = {
        speech: {
          create: vi.fn().mockImplementation(async (options) => {
            // Return a mock object that mimics the OpenAI API response
            return {
              arrayBuffer: async () => {
                // Create a mock audio buffer with voice and text info for verification
                const mockAudioContent = `mock_${options.voice}_${options.input.substring(0, 10)}`;
                return Buffer.from(mockAudioContent).buffer;
              }
            };
          })
        }
      };
    }
    
    // Declare a service instance and API test double for reuse
    let openaiApiDouble: any;
    let service: any;
    
    beforeEach(() => {
      // Create a fresh test double for each test
      openaiApiDouble = new OpenAITestDouble();
      // Create a service instance with our test double
      service = new ttsModule.OpenAITextToSpeechService(openaiApiDouble);
    });
    
    it('should be exported from the module', () => {
      expect(ttsModule.OpenAITextToSpeechService).toBeDefined();
      expect(typeof ttsModule.OpenAITextToSpeechService).toBe('function');
    });
    
    // Test the TTS service with our mock OpenAI API
    it('should synthesize speech using the OpenAI API', async () => {
      // Due to caching, we need to provide a unique text to force API call
      const uniqueText = `Hello world ${Date.now()}`;
      
      // Modify the mock implementation to verify parameters
      let capturedParams: any = null;
      openaiApiDouble.audio.speech.create.mockImplementationOnce(async (options) => {
        capturedParams = options;
        return {
          arrayBuffer: async () => Buffer.from('mock audio').buffer
        };
      });
      
      // Call the service with test parameters
      const buffer = await service.synthesizeSpeech({
        text: uniqueText,
        languageCode: 'en-US',
        preserveEmotions: false
      });
      
      // Verify parameters were correct
      expect(capturedParams).toBeDefined();
      expect(capturedParams.model).toBe('tts-1');
      expect(capturedParams.input).toBe(uniqueText);
      expect(capturedParams.voice).toBeDefined();
      
      // Verify we got a buffer back
      expect(Buffer.isBuffer(buffer)).toBe(true);
      expect(buffer.length).toBeGreaterThan(0);
    });
    
    // Test with emotion detection
    it('should detect and use emotions when preserveEmotions is true', async () => {
      // Make a unique emotional text to bypass cache
      const uniqueText = `This is amazing! I am so excited!!! ${Date.now()}`;
      
      // Capture parameters
      let capturedParams: any = null;
      openaiApiDouble.audio.speech.create.mockImplementationOnce(async (options) => {
        capturedParams = options;
        return {
          arrayBuffer: async () => Buffer.from('mock audio').buffer
        };
      });
      
      // Call with emotional text
      const buffer = await service.synthesizeSpeech({
        text: uniqueText,
        languageCode: 'en-US',
        preserveEmotions: true
      });
      
      // Verify parameters for excited text
      expect(capturedParams).toBeDefined();
      expect(capturedParams.model).toBe('tts-1');
      expect(capturedParams.input).toMatch(/amazing|excited/i);
      expect(capturedParams.speed).toBeGreaterThan(1.0); // Excited text should have faster speed
      
      // Verify we got a buffer back
      expect(Buffer.isBuffer(buffer)).toBe(true);
    });
    
    // Test error handling in the speech synthesis path
    it('should handle API errors gracefully', async () => {
      // Make the API throw an error
      openaiApiDouble.audio.speech.create.mockRejectedValueOnce(
        new Error('API error')
      );
      
      // Expect the service to throw with a helpful message
      await expect(
        service.synthesizeSpeech({
          text: 'Error test',
          languageCode: 'en-US'
        })
      ).rejects.toThrow('Speech synthesis failed');
    });
    
    // Test the utility functions that don't require an actual API call
    it('should detect emotions in text correctly', () => {
      // Access the private method
      const detectEmotions = service.detectEmotions.bind(service);
      
      // Test excited emotion detection
      const excitedResult = detectEmotions('This is amazing! I am so excited!!!');
      expect(excitedResult[0]?.emotion).toBe('excited');
      
      // Test serious emotion detection
      const seriousResult = detectEmotions('This is a serious warning. Important information follows.');
      expect(seriousResult[0]?.emotion).toBe('serious');
      
      // Test calm emotion detection
      const calmResult = detectEmotions('Relax and breathe. Stay calm and peaceful.');
      expect(calmResult[0]?.emotion).toBe('calm');
      
      // Test sad emotion detection
      const sadResult = detectEmotions('I am sad about this unfortunate situation 😢');
      expect(sadResult[0]?.emotion).toBe('sad');
      
      // Test no emotion detection
      const noEmotionResult = detectEmotions('This is a plain text without emotion markers.');
      expect(noEmotionResult.length).toBe(0);
    });
    
    it('should select appropriate voice for language', () => {
      // Access the private method
      const selectVoice = service.selectVoice.bind(service);
      
      // Test voice selection for different languages
      expect(selectVoice('en-US')).toMatch(/^(alloy|echo|fable|onyx|nova|shimmer)$/);
      expect(selectVoice('fr-FR')).toMatch(/^(alloy|nova|shimmer)$/);
      expect(selectVoice('ja-JP')).toMatch(/^(nova|alloy|echo)$/);
      expect(selectVoice('zh-CN')).toMatch(/^(alloy|nova|onyx)$/);
      
      // Test voice selection with emotions
      expect(selectVoice('en-US', 'excited')).toMatch(/^(echo|alloy|echo|fable|onyx|nova|shimmer)$/);
      expect(selectVoice('en-US', 'serious')).toMatch(/^(onyx|alloy|echo|fable|nova|shimmer)$/);
      expect(selectVoice('en-US', 'calm')).toMatch(/^(nova|alloy|echo|fable|onyx|shimmer)$/);
      expect(selectVoice('en-US', 'sad')).toMatch(/^(shimmer|alloy|echo|fable|onyx|nova)$/);
      
      // Test fallback for unsupported language
      expect(selectVoice('xx-XX')).toMatch(/^(nova|alloy)$/);
    });
    
    it('should format input text based on detected emotion', () => {
      // Access the private method
      const formatInputForEmotion = service.formatInputForEmotion.bind(service);
      
      // Test formatting for different emotions
      const excitedText = formatInputForEmotion('Hello world.', 'excited');
      expect(excitedText).toContain('!');
      
      const seriousText = formatInputForEmotion('Important information here.', 'serious');
      // Serious may have some uppercase words depending on random selection
      expect(seriousText.length).toBeGreaterThanOrEqual(26);
      
      const calmText = formatInputForEmotion('Take a breath.', 'calm');
      expect(calmText).toContain('...');
      
      const sadText = formatInputForEmotion('Bad news.', 'sad');
      expect(sadText).toContain('...');
    });
    
    it('should adjust speech parameters based on emotion', () => {
      // Access the private method
      const adjustSpeechParams = service.adjustSpeechParams.bind(service);
      
      // Test adjustments for different emotions
      const excited = adjustSpeechParams('excited', { 
        text: 'Test', 
        languageCode: 'en-US',
        speed: 1.0
      });
      expect(excited.speed).toBeGreaterThan(1.0);
      
      const serious = adjustSpeechParams('serious', { 
        text: 'Test', 
        languageCode: 'en-US',
        speed: 1.0
      });
      expect(serious.speed).toBeLessThan(1.0);
      
      const calm = adjustSpeechParams('calm', { 
        text: 'Test', 
        languageCode: 'en-US',
        speed: 1.0
      });
      expect(calm.speed).toBeLessThan(1.0);
      
      const sad = adjustSpeechParams('sad', { 
        text: 'Test', 
        languageCode: 'en-US',
        speed: 1.0
      });
      expect(sad.speed).toBeLessThan(1.0);
    });
    
    // Test the cache key generation
    it('should generate consistent cache keys for the same inputs', () => {
      // Access the private method
      const generateCacheKey = service.generateCacheKey.bind(service);
      
      const input1 = {
        text: 'Hello world',
        languageCode: 'en-US',
        voice: 'alloy',
        speed: 1.0,
        preserveEmotions: true
      };
      
      const input2 = { ...input1 };
      
      // Same inputs should generate same cache key
      const key1 = generateCacheKey(input1);
      const key2 = generateCacheKey(input2);
      expect(key1).toBe(key2);
      
      // Different inputs should produce different keys
      const input3 = { ...input1, text: 'Different text' };
      const key3 = generateCacheKey(input3);
      expect(key3).not.toBe(key1);
    });
  });
  
  describe('Text-To-Speech Service Convenience Function', () => {
    it('should export the textToSpeechService function', () => {
      expect(ttsModule.textToSpeechService).toBeDefined();
      expect(typeof ttsModule.textToSpeechService.synthesizeSpeech).toBe('function');
    });
    
    it('should use the service specified by environment variable', async () => {
      // Save original env
      const originalTtsType = process.env.TTS_SERVICE_TYPE;
      
      try {
        // Set specific service type
        process.env.TTS_SERVICE_TYPE = 'silent';
        
        // Reset modules to pick up env change
        vi.resetModules();
        const refreshedModule = await import('../../../server/services/TextToSpeechService');
        
        // Spy on the factory
        const getServiceSpy = vi.spyOn(refreshedModule.ttsFactory, 'getService');
        
        // Call the convenience function
        await refreshedModule.textToSpeechService.synthesizeSpeech({
          text: 'Test via convenience function',
          languageCode: 'en-US'
        });
        
        // Verify it used the right service type
        expect(getServiceSpy).toHaveBeenCalledWith('silent');
      } finally {
        // Restore original env variable
        if (originalTtsType === undefined) {
          delete process.env.TTS_SERVICE_TYPE;
        } else {
          process.env.TTS_SERVICE_TYPE = originalTtsType;
        }
      }
    });
  });
});