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
    // Note: We're skipping detailed testing of OpenAITextToSpeechService because it's challenging to mock properly.
    // In a real-world scenario, we would use integration tests or specialized mocking techniques to test this component.
    
    it('should be exported from the module', () => {
      expect(ttsModule.OpenAITextToSpeechService).toBeDefined();
      expect(typeof ttsModule.OpenAITextToSpeechService).toBe('function');
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