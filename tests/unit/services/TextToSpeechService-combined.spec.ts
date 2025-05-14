/**
 * Combined approach to TextToSpeechService tests
 * 
 * Using a simpler mocking approach that works reliably with ESM
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Create mock for OpenAI
vi.mock('openai', async () => {
  const mockCreate = vi.fn().mockImplementation(async (options) => {
    return {
      arrayBuffer: async () => new TextEncoder().encode('mock audio data').buffer
    };
  });
  
  const MockOpenAI = vi.fn().mockImplementation(() => ({
    audio: {
      speech: {
        create: mockCreate
      }
    }
  }));
  
  return {
    default: MockOpenAI
  };
});

// Mock fs/promises with a simplified approach
vi.mock('fs/promises', async () => {
  return {
    writeFile: vi.fn().mockResolvedValue(undefined),
    readFile: vi.fn().mockResolvedValue(Buffer.from('mock cached audio')),
    access: vi.fn().mockImplementation((path) => {
      if (path.includes('exists') || path.includes('audio-cache') || path.includes('temp')) {
        return Promise.resolve();
      }
      return Promise.reject(new Error('ENOENT'));
    }),
    mkdir: vi.fn().mockResolvedValue(undefined),
    stat: vi.fn().mockImplementation((path) => {
      if (path.includes('expired')) {
        return Promise.resolve({ mtimeMs: Date.now() - (25 * 60 * 60 * 1000) }); // Expired
      }
      return Promise.resolve({ mtimeMs: Date.now() - 1000 }); // Fresh
    })
  };
});

// Mock fs
vi.mock('fs', async () => {
  return {
    default: {
      constants: { F_OK: 0 },
      existsSync: vi.fn().mockReturnValue(true)
    },
    constants: { F_OK: 0 },
    existsSync: vi.fn().mockReturnValue(true),
    createReadStream: vi.fn().mockReturnValue({}),
    writeFile: vi.fn(),
    readFile: vi.fn(),
    mkdir: vi.fn(),
    stat: vi.fn(),
    access: vi.fn()
  };
});

// Mock path
vi.mock('path', async () => {
  const path = {
    join: vi.fn((...args) => args.join('/')),
    dirname: vi.fn((p) => p.substring(0, p.lastIndexOf('/') || 0)),
    resolve: vi.fn((...args) => args.join('/'))
  };

  return {
    default: path,
    ...path
  };
});

// Mock crypto
vi.mock('crypto', async () => {
  const mockHash = {
    update: vi.fn().mockReturnThis(),
    digest: vi.fn().mockReturnValue('mock-hash')
  };

  return {
    createHash: vi.fn().mockReturnValue(mockHash)
  };
});

// Mock util for promisify
vi.mock('util', async () => {
  const original = await vi.importActual('util');
  
  return {
    ...original,
    promisify: vi.fn().mockImplementation(fn => {
      return (...args) => Promise.resolve(Buffer.from('mock promisified result'));
    })
  };
});

// Set needed environment variables
vi.stubEnv('OPENAI_API_KEY', 'mock-api-key');

describe('TextToSpeechService Combined Tests', () => {
  let ttsModule: any;
  
  // Reset modules before each test
  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    
    // Import the module fresh each time
    ttsModule = await import('../../../server/services/TextToSpeechService');
  });
  
  afterEach(() => {
    vi.restoreAllMocks();
  });
  
  describe('SilentTextToSpeechService', () => {
    it('should return an empty buffer from synthesizeSpeech', async () => {
      const silentService = new ttsModule.SilentTextToSpeechService();
      const result = await silentService.synthesizeSpeech({ text: 'Test', languageCode: 'en-US' });
      
      expect(Buffer.isBuffer(result)).toBe(true);
      expect(result.length).toBe(0);
    });
  });
  
  describe('BrowserSpeechSynthesisService', () => {
    it('should return a marker buffer with JSON content', async () => {
      const browserService = new ttsModule.BrowserSpeechSynthesisService();
      const result = await browserService.synthesizeSpeech({ 
        text: 'Test speech',
        languageCode: 'en-US',
        speed: 1.2
      });
      
      expect(Buffer.isBuffer(result)).toBe(true);
      
      // Should be JSON parseable
      const parsed = JSON.parse(result.toString());
      expect(parsed.type).toBe('browser-speech');
      expect(parsed.text).toBe('Test speech');
      expect(parsed.languageCode).toBe('en-US');
      expect(parsed.speed).toBe(1.2);
    });
  });
  
  describe('OpenAITextToSpeechService', () => {
    let openAIService: any;
    let mockOpenAI: any;
    
    beforeEach(() => {
      mockOpenAI = {
        audio: {
          speech: {
            create: vi.fn().mockResolvedValue({
              arrayBuffer: async () => new TextEncoder().encode('mock openai audio').buffer
            })
          }
        }
      };
      
      openAIService = new ttsModule.OpenAITextToSpeechService(mockOpenAI);
    });
    
    it('should create directories if they do not exist', async () => {
      // Mock fs/promises.access to simulate directories not existing
      const fsPromises = await import('fs/promises');
      const accessSpy = vi.spyOn(fsPromises, 'access')
        .mockRejectedValueOnce(new Error('ENOENT')) // First call for cache dir
        .mockRejectedValueOnce(new Error('ENOENT')); // Second call for temp dir
      
      const mkdirSpy = vi.spyOn(fsPromises, 'mkdir').mockResolvedValue(undefined);
      
      // Creating a new service should ensure directories exist
      const service = new ttsModule.OpenAITextToSpeechService(mockOpenAI);
      
      // Should have tried to check if directories exist
      expect(accessSpy).toHaveBeenCalledTimes(2);
      
      // Should have created directories
      expect(mkdirSpy).toHaveBeenCalledTimes(2);
      expect(mkdirSpy.mock.calls[0][0]).toContain('audio-cache');
      expect(mkdirSpy.mock.calls[1][0]).toContain('temp');
    });
    
    it('should generate a consistent cache key', () => {
      const options = {
        text: 'Test text',
        languageCode: 'en-US',
        voice: 'echo'
      };
      
      // Access private method
      const generateCacheKey = openAIService.generateCacheKey.bind(openAIService);
      
      // Same options should produce the same key
      const key1 = generateCacheKey(options);
      const key2 = generateCacheKey({ ...options });
      expect(key1).toBe(key2);
      
      // Different options should produce different keys
      const key3 = generateCacheKey({ ...options, text: 'Different text' });
      expect(key1).not.toBe(key3);
    });
    
    it('should return cached audio when available and not expired', async () => {
      // Mock fs/promises functions for this test
      const fsPromises = await import('fs/promises');
      
      // Simulate cache hit
      vi.spyOn(fsPromises, 'access').mockResolvedValueOnce(undefined);
      vi.spyOn(fsPromises, 'stat').mockResolvedValueOnce({ mtimeMs: Date.now() - 1000 } as any);
      vi.spyOn(fsPromises, 'readFile').mockResolvedValueOnce(Buffer.from('cached data'));
      
      // Spy on the internal methods
      const getCachedAudioSpy = vi.spyOn(openAIService, 'getCachedAudio' as any);
      
      // Call the public method that would use cache
      const result = await openAIService.synthesizeSpeech({
        text: 'Cached text',
        languageCode: 'en-US'
      });
      
      // Should have checked cache
      expect(getCachedAudioSpy).toHaveBeenCalled();
      
      // Should have returned cached data
      expect(Buffer.isBuffer(result)).toBe(true);
      expect(result.toString()).toBe('cached data');
    });
    
    it('should detect emotions in text', () => {
      // Access the private method
      const detectEmotions = openAIService.detectEmotions.bind(openAIService);
      
      // Test with various emotional texts
      const excitedText = 'This is amazing and fantastic! I am so excited! 😄';
      const excitedResult = detectEmotions(excitedText);
      expect(excitedResult.length).toBeGreaterThan(0);
      expect(excitedResult[0].emotion).toBe('excited');
      
      const seriousText = 'Warning: This is a critical and important message.';
      const seriousResult = detectEmotions(seriousText);
      expect(seriousResult.length).toBeGreaterThan(0);
      expect(seriousResult[0].emotion).toBe('serious');
      
      const neutralText = 'This is a normal sentence without emotion.';
      const neutralResult = detectEmotions(neutralText);
      expect(neutralResult.length).toBe(0);
    });
    
    it('should select voices appropriate for the language', () => {
      // Access the private method
      const selectVoice = openAIService.selectVoice.bind(openAIService);
      
      // Test various language codes
      expect(selectVoice('en-US')).toBeDefined();
      expect(selectVoice('fr-FR')).toBeDefined();
      expect(selectVoice('es-ES')).toBeDefined();
      expect(selectVoice('de-DE')).toBeDefined();
      
      // Test with unknown language - should fallback
      expect(selectVoice('xx-XX')).toBeDefined();
      
      // Test with emotion hints
      const excitedVoice = selectVoice('en-US', 'excited');
      const seriousVoice = selectVoice('en-US', 'serious');
      expect(excitedVoice).toBeDefined();
      expect(seriousVoice).toBeDefined();
    });
    
    it('should synthesize speech with OpenAI when cache misses', async () => {
      // Mock fs/promises functions for cache miss
      const fsPromises = await import('fs/promises');
      vi.spyOn(fsPromises, 'access').mockRejectedValueOnce(new Error('ENOENT'));
      
      // Spy on OpenAI call
      const createSpy = vi.spyOn(mockOpenAI.audio.speech, 'create');
      
      // Call synthesizeSpeech
      await openAIService.synthesizeSpeech({
        text: 'New text to synthesize',
        languageCode: 'en-US'
      });
      
      // Should have called OpenAI
      expect(createSpy).toHaveBeenCalledTimes(1);
      expect(createSpy).toHaveBeenCalledWith(expect.objectContaining({
        model: 'tts-1',
        input: 'New text to synthesize'
      }));
    });
    
    it('should cache synthesized audio', async () => {
      // Mock a cache miss followed by successful synthesis
      const fsPromises = await import('fs/promises');
      vi.spyOn(fsPromises, 'access').mockRejectedValueOnce(new Error('ENOENT'));
      const writeFileSpy = vi.spyOn(fsPromises, 'writeFile').mockResolvedValueOnce(undefined);
      
      // Call synthesizeSpeech
      await openAIService.synthesizeSpeech({
        text: 'Text to cache',
        languageCode: 'en-US'
      });
      
      // Should have written to cache
      expect(writeFileSpy).toHaveBeenCalledTimes(1);
    });
    
    it('should handle synthesis errors gracefully', async () => {
      // Mock a cache miss
      const fsPromises = await import('fs/promises');
      vi.spyOn(fsPromises, 'access').mockRejectedValueOnce(new Error('ENOENT'));
      
      // Mock OpenAI error
      mockOpenAI.audio.speech.create.mockRejectedValueOnce(new Error('OpenAI API error'));
      
      // Attempt should throw
      await expect(openAIService.synthesizeSpeech({
        text: 'Error text',
        languageCode: 'en-US'
      })).rejects.toThrow('Speech synthesis failed');
    });
  });
  
  describe('TextToSpeechFactory', () => {
    it('should be implemented as a singleton', () => {
      const instance1 = ttsModule.TextToSpeechFactory.getInstance();
      const instance2 = ttsModule.TextToSpeechFactory.getInstance();
      
      expect(instance1).toBe(instance2);
    });
    
    it('should provide access to different service types', () => {
      const factory = ttsModule.TextToSpeechFactory.getInstance();
      
      const openaiService = factory.getService('openai');
      expect(openaiService).toBeInstanceOf(ttsModule.OpenAITextToSpeechService);
      
      const browserService = factory.getService('browser');
      expect(browserService).toBeInstanceOf(ttsModule.BrowserSpeechSynthesisService);
      
      const silentService = factory.getService('silent');
      expect(silentService).toBeInstanceOf(ttsModule.SilentTextToSpeechService);
    });
    
    it('should fall back to OpenAI service for unknown types', () => {
      const factory = ttsModule.TextToSpeechFactory.getInstance();
      
      const unknownService = factory.getService('unknown-type');
      expect(unknownService).toBeInstanceOf(ttsModule.OpenAITextToSpeechService);
    });
  });
  
  describe('textToSpeechService convenience export', () => {
    it('should use the environment-specified service type', async () => {
      // Set environment service type
      vi.stubEnv('TTS_SERVICE_TYPE', 'silent');
      
      // Re-import to get fresh instances with new env
      const freshModule = await import('../../../server/services/TextToSpeechService');
      
      // Spy on the factory
      const getServiceSpy = vi.spyOn(freshModule.ttsFactory, 'getService');
      
      // Call the convenience function
      await freshModule.textToSpeechService.synthesizeSpeech({
        text: 'Test',
        languageCode: 'en-US'
      });
      
      // Should have used the environment-specified type
      expect(getServiceSpy).toHaveBeenCalledWith('silent');
      
      // Reset environment
      vi.unstubEnv('TTS_SERVICE_TYPE');
    });
    
    it('should default to openai service when not specified', async () => {
      // Ensure no environment service type is set
      vi.stubEnv('TTS_SERVICE_TYPE', undefined);
      
      // Re-import to get fresh instances with new env
      const freshModule = await import('../../../server/services/TextToSpeechService');
      
      // Spy on the factory
      const getServiceSpy = vi.spyOn(freshModule.ttsFactory, 'getService');
      
      // Call the convenience function
      await freshModule.textToSpeechService.synthesizeSpeech({
        text: 'Test',
        languageCode: 'en-US'
      });
      
      // Should have used the default type
      expect(getServiceSpy).toHaveBeenCalledWith('openai');
    });
  });
});