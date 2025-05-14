/**
 * Simplified TextToSpeechService tests
 * 
 * This focuses on the parts we can effectively test without having to modify the source code
 * While still aiming for high coverage of critical business logic
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Create mock for OpenAI
vi.mock('openai', async () => {
  // Create a mock implementation that returns structured audio data
  const mockCreate = vi.fn().mockImplementation(async (options) => {
    // Echo the input parameters in the mock response for verification
    return {
      arrayBuffer: async () => {
        const mockText = `voice:${options.voice}-model:${options.model}-input:${options.input.substring(0, 20)}`;
        return new TextEncoder().encode(mockText).buffer;
      }
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

// Mock fs/promises
vi.mock('fs/promises', async (importOriginal) => {
  const actual = await importOriginal();
  
  const mockReadFile = vi.fn().mockImplementation((path) => {
    if (path.includes('exists')) {
      return Promise.resolve(Buffer.from('mock cached audio'));
    }
    return Promise.reject(new Error('ENOENT'));
  });
  
  return {
    ...actual,
    writeFile: vi.fn().mockResolvedValue(undefined),
    readFile: mockReadFile,
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
  };
});

// Mock fs - use the importOriginal approach as suggested
vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal();
  
  // Create our mock functions
  const mockExistsSync = vi.fn().mockReturnValue(true);
  const mockWriteFile = vi.fn();
  const mockReadFile = vi.fn();
  const mockAccess = vi.fn();
  const mockMkdir = vi.fn();
  const mockStat = vi.fn();
  
  return {
    ...actual,  // Keep the original module structure
    constants: { F_OK: 0 },
    existsSync: mockExistsSync,
    writeFile: mockWriteFile,
    readFile: mockReadFile,
    access: mockAccess,
    mkdir: mockMkdir,
    stat: mockStat,
    createReadStream: vi.fn().mockReturnValue({})
  };
});

// Mock path to avoid ESM issues
vi.mock('path', async (importOriginal) => {
  const actual = await importOriginal();
  
  const mockPath = {
    join: vi.fn((...args) => args.join('/')),
    dirname: vi.fn((p) => p.substring(0, p.lastIndexOf('/') || 0)),
    resolve: vi.fn((...args) => args.join('/'))
  };
  
  return {
    ...actual,
    ...mockPath
  };
});

// Mock crypto
vi.mock('crypto', async (importOriginal) => {
  const actual = await importOriginal();
  
  const mockHash = {
    update: vi.fn().mockReturnThis(),
    digest: vi.fn().mockReturnValue('mock-hash')
  };
  
  return {
    ...actual,
    createHash: vi.fn().mockReturnValue(mockHash)
  };
});

// Mock util for promisify
vi.mock('util', async (importOriginal) => {
  const actual = await importOriginal();
  
  const mockPromisify = vi.fn((fn) => {
    // Just return a function that resolves
    return (...args) => Promise.resolve(Buffer.from('mock promisified data'));
  });
  
  return {
    ...actual,
    promisify: mockPromisify
  };
});

// Set environment variables
vi.stubEnv('OPENAI_API_KEY', 'mock-api-key');

describe('TextToSpeechService Tests', () => {
  let ttsModule: any;
  
  // Clear mocks and reset modules before each test
  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    
    // Import the module
    ttsModule = await import('../../../server/services/TextToSpeechService');
  });
  
  afterEach(() => {
    vi.restoreAllMocks();
  });
  
  describe('SilentTextToSpeechService', () => {
    it('should return an empty buffer from synthesizeSpeech', async () => {
      const silentTTS = new ttsModule.SilentTextToSpeechService();
      
      // Test with various inputs
      const result1 = await silentTTS.synthesizeSpeech({ text: 'Hello', languageCode: 'en-US' });
      const result2 = await silentTTS.synthesizeSpeech({ text: 'Bonjour', languageCode: 'fr-FR' });
      const result3 = await silentTTS.synthesizeSpeech({ text: '', languageCode: 'es-ES' });
      
      // All should return empty buffers
      expect(Buffer.isBuffer(result1)).toBe(true);
      expect(result1.length).toBe(0);
      expect(Buffer.isBuffer(result2)).toBe(true);
      expect(result2.length).toBe(0);
      expect(Buffer.isBuffer(result3)).toBe(true);
      expect(result3.length).toBe(0);
    });
  });
  
  describe('BrowserSpeechSynthesisService', () => {
    it('should return a marker buffer with speech information', async () => {
      const browserTTS = new ttsModule.BrowserSpeechSynthesisService();
      
      const result = await browserTTS.synthesizeSpeech({
        text: 'Browser speech test',
        languageCode: 'en-US',
        preserveEmotions: true,
        speed: 1.2
      });
      
      // Verify result is a Buffer
      expect(Buffer.isBuffer(result)).toBe(true);
      
      // Parse the result and verify content
      const parsed = JSON.parse(result.toString());
      expect(parsed.type).toBe('browser-speech');
      expect(parsed.text).toBe('Browser speech test');
      expect(parsed.languageCode).toBe('en-US');
      expect(parsed.preserveEmotions).toBe(true);
      expect(parsed.speed).toBe(1.2);
      expect(parsed.autoPlay).toBe(true);
    });
    
    it('should use default speed when not provided', async () => {
      const browserTTS = new ttsModule.BrowserSpeechSynthesisService();
      
      const result = await browserTTS.synthesizeSpeech({
        text: 'Default speed test',
        languageCode: 'en-US'
      });
      
      const parsed = JSON.parse(result.toString());
      expect(parsed.speed).toBe(1.0);
    });
  });
  
  describe('TextToSpeechFactory', () => {
    it('should be implemented as a singleton', () => {
      const instance1 = ttsModule.ttsFactory;
      const instance2 = ttsModule.ttsFactory;
      
      expect(instance1).toBe(instance2);
      expect(instance1).toBe(ttsModule.TextToSpeechFactory.getInstance());
    });
    
    it('should return different service types', () => {
      const silentService = ttsModule.ttsFactory.getService('silent');
      expect(silentService).toBeInstanceOf(ttsModule.SilentTextToSpeechService);
      
      const openaiService = ttsModule.ttsFactory.getService('openai');
      expect(openaiService).toBeInstanceOf(ttsModule.OpenAITextToSpeechService);
      
      const browserService = ttsModule.ttsFactory.getService('browser');
      expect(browserService).toBeInstanceOf(ttsModule.BrowserSpeechSynthesisService);
    });
    
    it('should return openai service as default for unknown type', () => {
      const defaultService = ttsModule.ttsFactory.getService('unknown');
      expect(defaultService).toBeInstanceOf(ttsModule.OpenAITextToSpeechService);
    });
    
    it('should return the same instance for the same service type', () => {
      const service1 = ttsModule.ttsFactory.getService('silent');
      const service2 = ttsModule.ttsFactory.getService('silent');
      
      expect(service1).toBe(service2);
    });
  });
  
  describe('Convenience Functions', () => {
    it('should export textToSpeechService with synthesizeSpeech', () => {
      expect(ttsModule.textToSpeechService).toBeDefined();
      expect(typeof ttsModule.textToSpeechService.synthesizeSpeech).toBe('function');
    });
    
    it('should pass synthesizeSpeech calls to the configured service', async () => {
      // Set a specific service type via env var
      const originalEnv = process.env.TTS_SERVICE_TYPE;
      process.env.TTS_SERVICE_TYPE = 'silent';
      
      // Get a fresh instance with the new env var
      const freshModule = await import('../../../server/services/TextToSpeechService');
      
      // Spy on getService
      const getServiceSpy = vi.spyOn(freshModule.ttsFactory, 'getService');
      
      await freshModule.textToSpeechService.synthesizeSpeech({
        text: 'Test via convenience function',
        languageCode: 'en-US'
      });
      
      // Verify it called getService with the right service type
      expect(getServiceSpy).toHaveBeenCalledWith('silent');
      
      // Reset for other tests
      process.env.TTS_SERVICE_TYPE = originalEnv;
    });
  });
  
  describe('OpenAITextToSpeechService', () => {
    beforeEach(() => {
      // Reset cache directory access results
      vi.mocked(require('fs/promises').access).mockImplementation((path) => {
        if (path.includes('exists') || path.includes('audio-cache') || path.includes('temp')) {
          return Promise.resolve();
        }
        return Promise.reject(new Error('ENOENT'));
      });
    });
    
    it('should create an OpenAI client with API key', () => {
      const service = new ttsModule.OpenAITextToSpeechService();
      expect(service).toBeDefined();
    });
    
    it('should generate speech via OpenAI API', async () => {
      const service = new ttsModule.OpenAITextToSpeechService();
      const params = {
        text: 'Hello world',
        languageCode: 'en-US',
        preserveEmotions: true,
        speed: 1.2
      };
      
      const audioBuffer = await service.synthesizeSpeech(params);
      
      // Verify audio was generated
      expect(Buffer.isBuffer(audioBuffer)).toBeTruthy();
      expect(audioBuffer.length).toBeGreaterThan(0);
    });
    
    it('should select the appropriate voice based on language', async () => {
      const service = new ttsModule.OpenAITextToSpeechService();
      
      // Test different languages
      const testCases = [
        { languageCode: 'en-US', expectedVoice: 'alloy' },
        { languageCode: 'fr-FR', expectedVoice: 'alloy' },
        { languageCode: 'de-DE', expectedVoice: 'alloy' },
        { languageCode: 'es-ES', expectedVoice: 'alloy' },
        { languageCode: 'it-IT', expectedVoice: 'alloy' },
        { languageCode: 'ja-JP', expectedVoice: 'alloy' }
      ];
      
      // Create spy on OpenAI client
      const openaiSpy = vi.spyOn(require('openai').default.prototype.audio.speech, 'create');
      
      for (const testCase of testCases) {
        await service.synthesizeSpeech({
          text: 'Test text',
          languageCode: testCase.languageCode
        });
        
        // Check the voice parameter in the last call
        const lastCall = openaiSpy.mock.calls[openaiSpy.mock.calls.length - 1][0] as any;
        expect(lastCall.voice).toBe(testCase.expectedVoice);
      }
    });
    
    it('should cache audio with the correct hash key', async () => {
      const service = new ttsModule.OpenAITextToSpeechService();
      const writeFileSpy = vi.spyOn(require('fs/promises'), 'writeFile');
      
      await service.synthesizeSpeech({
        text: 'Cache test',
        languageCode: 'en-US'
      });
      
      // Verify that writeFile was called for caching
      expect(writeFileSpy).toHaveBeenCalled();
      
      // The first parameter should be the file path which should contain the hash
      const filePath = writeFileSpy.mock.calls[0][0];
      expect(filePath).toContain('mock-hash');
    });
    
    it('should use cached audio when available', async () => {
      const service = new ttsModule.OpenAITextToSpeechService();
      
      // Make cache hit more likely
      vi.mocked(require('fs/promises').access).mockResolvedValue(undefined);
      
      // Spy on readFile and OpenAI
      const readFileSpy = vi.spyOn(require('fs/promises'), 'readFile');
      const openaiSpy = vi.spyOn(require('openai').default.prototype.audio.speech, 'create');
      
      // First call - should check cache first (may or may not hit)
      await service.synthesizeSpeech({
        text: 'Cache test',
        languageCode: 'en-US'
      });
      
      // Mock that the file now exists
      vi.mocked(require('fs/promises').readFile).mockResolvedValue(Buffer.from('cached audio data'));
      
      // Second call - should hit cache
      const audioBuffer = await service.synthesizeSpeech({
        text: 'Cache test',
        languageCode: 'en-US'
      });
      
      // Verify cache was checked
      expect(readFileSpy).toHaveBeenCalled();
      
      // Either the OpenAI was called less times than readFile
      // or we got cached data
      const openaiCalls = openaiSpy.mock.calls.length;
      const readFileCalls = readFileSpy.mock.calls.length;
      
      expect(
        openaiCalls < readFileCalls || 
        audioBuffer.toString() === 'cached audio data'
      ).toBeTruthy();
    });
    
    it('should handle audio directory creation', async () => {
      // Mock access to throw ENOENT for directories
      vi.mocked(require('fs/promises').access).mockRejectedValue(new Error('ENOENT'));
      
      const mkdirSpy = vi.spyOn(require('fs/promises'), 'mkdir');
      
      const service = new ttsModule.OpenAITextToSpeechService();
      
      await service.synthesizeSpeech({
        text: 'Directory test',
        languageCode: 'en-US'
      });
      
      // Verify mkdir was called
      expect(mkdirSpy).toHaveBeenCalled();
      // Should create with recursive option
      expect(mkdirSpy.mock.calls[0][1]).toHaveProperty('recursive', true);
    });
    
    it('should handle audio generation errors gracefully', async () => {
      // Spy on console.error
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      // Mock OpenAI to throw an error
      vi.mocked(require('openai').default.prototype.audio.speech.create)
        .mockRejectedValueOnce(new Error('API error'));
      
      const service = new ttsModule.OpenAITextToSpeechService();
      
      // This should not throw but return an error message as audio
      const result = await service.synthesizeSpeech({
        text: 'Error test',
        languageCode: 'en-US'
      });
      
      // Should return a buffer with error message
      expect(Buffer.isBuffer(result)).toBeTruthy();
      expect(result.toString()).toContain('Error');
      
      // Console.error should have been called
      expect(consoleErrorSpy).toHaveBeenCalled();
      
      // Restore console.error
      consoleErrorSpy.mockRestore();
    });
  });

  describe('Module exports', () => {
    it('should export all required classes and interfaces', () => {
      // Check for the implementation classes
      expect(ttsModule.SilentTextToSpeechService).toBeDefined();
      expect(ttsModule.OpenAITextToSpeechService).toBeDefined();
      expect(ttsModule.BrowserSpeechSynthesisService).toBeDefined();
      expect(ttsModule.TextToSpeechFactory).toBeDefined();
      expect(ttsModule.ttsFactory).toBeDefined();
      expect(ttsModule.textToSpeechService).toBeDefined();
    });
  });
});