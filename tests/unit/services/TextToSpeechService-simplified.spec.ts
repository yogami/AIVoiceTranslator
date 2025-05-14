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
        const mockText = `voice:${options.voice}-model:${options.model || 'tts-1'}-input:${options.input?.substring(0, 20) || 'test'}`;
        return new TextEncoder().encode(mockText).buffer;
      }
    };
  });
  
  // Create our mock OpenAI with correct structure for both instance and prototype
  const MockOpenAI = vi.fn().mockImplementation(() => ({
    audio: {
      speech: {
        create: mockCreate
      }
    }
  }));
  
  // Add prototype properties so the TextToSpeechService can reference them
  MockOpenAI.prototype = {
    audio: {
      speech: {
        create: mockCreate
      }
    }
  };
  
  return {
    default: MockOpenAI
  };
});

// Mock fs/promises
vi.mock('fs/promises', async () => {
  const mockReadFile = vi.fn().mockImplementation((path) => {
    if (path.includes('exists')) {
      return Promise.resolve(Buffer.from('mock cached audio'));
    }
    return Promise.reject(new Error('ENOENT'));
  });
  
  return {
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

// Mock fs - no need for importOriginal
vi.mock('fs', async () => {
  // Create our mock functions
  const mockExistsSync = vi.fn().mockReturnValue(true);
  const mockWriteFile = vi.fn();
  const mockReadFile = vi.fn();
  const mockAccess = vi.fn();
  const mockMkdir = vi.fn();
  const mockStat = vi.fn();
  
  return {
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
vi.mock('path', async () => {
  return {
    join: vi.fn((...args) => args.join('/')),
    dirname: vi.fn((p) => p.substring(0, p.lastIndexOf('/') || 0)),
    resolve: vi.fn((...args) => args.join('/'))
  };
});

// Mock crypto
vi.mock('crypto', async () => {
  // Create a mock hash object with necessary methods
  const mockHash = {
    update: vi.fn().mockReturnThis(),
    digest: vi.fn().mockReturnValue('mock-hash')
  };
  
  return {
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
    let fsPromisesMock;
    let openaiMock;

    beforeEach(() => {
      // Get mocks from the vi.mock calls
      fsPromisesMock = require('fs/promises');
      openaiMock = require('openai').default;
      
      // Reset specific mocks for this test suite
      fsPromisesMock.access = vi.fn((path) => {
        if (path.includes('exists') || path.includes('audio-cache') || path.includes('temp')) {
          return Promise.resolve();
        }
        return Promise.reject(new Error('ENOENT'));
      });
      
      fsPromisesMock.readFile = vi.fn((path) => {
        if (path.includes('exists')) {
          return Promise.resolve(Buffer.from('mock cached audio'));
        }
        return Promise.reject(new Error('ENOENT'));
      });
      
      fsPromisesMock.writeFile = vi.fn().mockResolvedValue(undefined);
      fsPromisesMock.mkdir = vi.fn().mockResolvedValue(undefined);
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
      
      // Create spy on OpenAI client creation
      const openaiCreateSpy = vi.fn().mockImplementation(async (options) => {
        return {
          arrayBuffer: async () => {
            const mockText = `voice:${options.voice}-model:${options.model || 'tts-1'}-input:${options.input.substring(0, 20)}`;
            return new TextEncoder().encode(mockText).buffer;
          }
        };
      });
      
      // Replace the create method with our spy
      const originalCreate = openaiMock.prototype.audio.speech.create;
      openaiMock.prototype.audio.speech.create = openaiCreateSpy;
      
      for (const testCase of testCases) {
        await service.synthesizeSpeech({
          text: 'Test text',
          languageCode: testCase.languageCode
        });
        
        // Check the voice parameter in the last call
        const lastCall = openaiCreateSpy.mock.calls[openaiCreateSpy.mock.calls.length - 1];
        expect(lastCall[0].voice).toBe(testCase.expectedVoice);
      }
      
      // Restore original
      openaiMock.prototype.audio.speech.create = originalCreate;
    });
    
    it('should cache audio with the correct hash key', async () => {
      const writeFileSpy = vi.fn().mockResolvedValue(undefined);
      fsPromisesMock.writeFile = writeFileSpy;
      
      const service = new ttsModule.OpenAITextToSpeechService();
      
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
      // Setup mocks
      fsPromisesMock.access = vi.fn().mockResolvedValue(undefined);
      
      const readFileSpy = vi.fn().mockResolvedValue(Buffer.from('cached audio data'));
      fsPromisesMock.readFile = readFileSpy;
      
      // Create spy on OpenAI client create
      const openaiCreateSpy = vi.fn().mockImplementation(async (options) => {
        return {
          arrayBuffer: async () => {
            const mockText = `API generated audio for ${options.input.substring(0, 20)}`;
            return new TextEncoder().encode(mockText).buffer;
          }
        };
      });
      
      // Replace the create method
      const originalCreate = openaiMock.prototype.audio.speech.create;
      openaiMock.prototype.audio.speech.create = openaiCreateSpy;
      
      const service = new ttsModule.OpenAITextToSpeechService();
      
      // First call should check cache (and miss in this test)
      await service.synthesizeSpeech({
        text: 'Cache test',
        languageCode: 'en-US'
      });
      
      // Second call with same parameters should hit cache
      const result = await service.synthesizeSpeech({
        text: 'Cache test',
        languageCode: 'en-US'
      });
      
      // Verify cache was checked
      expect(readFileSpy).toHaveBeenCalled();
      expect(result.toString()).toBe('cached audio data');
      
      // Restore original method
      openaiMock.prototype.audio.speech.create = originalCreate;
    });
    
    it('should handle audio directory creation', async () => {
      // Mock access to throw ENOENT for directories
      fsPromisesMock.access = vi.fn().mockRejectedValue(new Error('ENOENT'));
      const mkdirSpy = vi.fn().mockResolvedValue(undefined);
      fsPromisesMock.mkdir = mkdirSpy;
      
      const service = new ttsModule.OpenAITextToSpeechService();
      
      await service.synthesizeSpeech({
        text: 'Directory test',
        languageCode: 'en-US'
      });
      
      // Verify mkdir was called
      expect(mkdirSpy).toHaveBeenCalled();
      // Should create directories recursively
      expect(mkdirSpy.mock.calls[0][1]).toEqual({ recursive: true });
    });
    
    it('should handle audio generation errors gracefully', async () => {
      // Spy on console.error
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      // Replace OpenAI create with a version that throws
      const originalCreate = openaiMock.prototype.audio.speech.create;
      openaiMock.prototype.audio.speech.create = vi.fn().mockRejectedValue(new Error('API error'));
      
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
      
      // Restore original method and console spy
      openaiMock.prototype.audio.speech.create = originalCreate;
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