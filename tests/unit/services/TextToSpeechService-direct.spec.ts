/**
 * Basic TextToSpeechService Tests - Direct Approach
 * 
 * This file uses a simpler approach to testing the TextToSpeechService module
 * to avoid ESM mocking complexities.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock these modules directly without trying importOriginal which is causing issues
vi.mock('fs', () => ({
  constants: { F_OK: 0 },
  existsSync: vi.fn().mockReturnValue(true),
  createReadStream: vi.fn().mockReturnValue({}),
  writeFile: vi.fn(),
  readFile: vi.fn(),
  access: vi.fn(),
  mkdir: vi.fn(),
  stat: vi.fn()
}));

vi.mock('fs/promises', () => ({
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
}));

vi.mock('path', () => ({
  join: vi.fn((...args) => args.join('/')),
  dirname: vi.fn((p) => p.substring(0, p.lastIndexOf('/') || 0)),
  resolve: vi.fn((...args) => args.join('/'))
}));

vi.mock('crypto', () => {
  const mockHash = {
    update: vi.fn().mockReturnThis(),
    digest: vi.fn().mockReturnValue('mock-hash')
  };
  
  return {
    createHash: vi.fn().mockReturnValue(mockHash)
  };
});

vi.mock('util', () => ({
  promisify: vi.fn((fn) => {
    return (...args) => Promise.resolve(Buffer.from('mock promisified data'));
  })
}));

// Mock openai
vi.mock('openai', () => {
  // Create a mock OpenAI instance
  const mockCreate = vi.fn().mockImplementation(async (options) => {
    return {
      arrayBuffer: async () => {
        const mockText = `voice:${options.voice}-model:${options.model || 'tts-1'}-input:${options.input?.substring(0, 20) || 'test'}`;
        return new TextEncoder().encode(mockText).buffer;
      }
    };
  });
  
  // Define the OpenAI constructor mock
  const MockOpenAI = vi.fn().mockImplementation(() => ({
    audio: {
      speech: {
        create: mockCreate
      }
    }
  }));
  
  // The prototype pattern was causing issues, use a simpler approach
  return {
    default: MockOpenAI
  };
});

// Set environment variables
vi.stubEnv('OPENAI_API_KEY', 'mock-api-key');

describe('TextToSpeechService Basic Tests', () => {
  let ttsModule: any;
  
  // Import the module fresh for each test
  beforeEach(async () => {
    vi.clearAllMocks();
    
    // Dynamic import to get a fresh module with our mocks applied
    ttsModule = await import('../../../server/services/TextToSpeechService');
  });
  
  afterEach(() => {
    vi.restoreAllMocks();
  });
  
  describe('SilentTextToSpeechService', () => {
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
  });
  
  describe('OpenAITextToSpeechService', () => {
    it('should create an instance with OpenAI client', () => {
      const service = new ttsModule.OpenAITextToSpeechService();
      expect(service).toBeDefined();
    });
    
    it('should handle audio generation', async () => {
      const service = new ttsModule.OpenAITextToSpeechService();
      
      // Set up console.error spy
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      const result = await service.synthesizeSpeech({
        text: 'Test text',
        languageCode: 'en-US'
      });
      
      // Should return some kind of buffer
      expect(Buffer.isBuffer(result)).toBeTruthy();
      
      // Clean up
      consoleErrorSpy.mockRestore();
    });
  });
});