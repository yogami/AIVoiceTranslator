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

// Mock fs
vi.mock('fs', async () => {
  const mockConstants = { F_OK: 0 };
  const mockExistsSync = vi.fn().mockReturnValue(true);
  
  return {
    constants: mockConstants,
    existsSync: mockExistsSync,
    // These functions are used with promisify, so we add stubs
    writeFile: vi.fn(),
    readFile: vi.fn(),
    access: vi.fn(),
    mkdir: vi.fn(),
    stat: vi.fn(),
    createReadStream: vi.fn().mockReturnValue({})
  };
});

// Mock path to avoid ESM issues
vi.mock('path', async () => {
  const mockPath = {
    join: vi.fn((...args) => args.join('/')),
    dirname: vi.fn((p) => p.substring(0, p.lastIndexOf('/') || 0)),
    resolve: vi.fn((...args) => args.join('/'))
  };
  
  return {
    default: mockPath,
    ...mockPath
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
  const mockPromisify = vi.fn((fn) => {
    // Just return a function that resolves
    return (...args) => Promise.resolve(Buffer.from('mock promisified data'));
  });
  
  return {
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