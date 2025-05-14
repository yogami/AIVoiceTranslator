/**
 * Tests for TextToSpeechService implementation classes
 *
 * These tests verify the implementation details of the various
 * TextToSpeechService classes.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock OpenAI client
vi.mock('openai', () => {
  const mockArrayBuffer = new ArrayBuffer(128);
  const mockBuffer = Buffer.from(mockArrayBuffer);
  
  return {
    default: vi.fn().mockImplementation(() => ({
      audio: {
        speech: {
          create: vi.fn().mockResolvedValue({ 
            arrayBuffer: vi.fn().mockResolvedValue(mockArrayBuffer),
            buffer: vi.fn().mockResolvedValue(mockBuffer)
          }),
        },
      },
    })),
  };
});

// Mock environment variables
vi.stubEnv('OPENAI_API_KEY', 'test-api-key');

describe('TextToSpeechService Implementations', () => {
  let TextToSpeechService: any;
  let BrowserSpeechSynthesisService: any;
  let SilentTextToSpeechService: any;
  let OpenAITextToSpeechService: any;
  let TextToSpeechFactory: any;
  
  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    
    // Import module
    const ttsModule = await import('../../../server/services/TextToSpeechService');
    BrowserSpeechSynthesisService = ttsModule.BrowserSpeechSynthesisService;
    SilentTextToSpeechService = ttsModule.SilentTextToSpeechService;
    OpenAITextToSpeechService = ttsModule.OpenAITextToSpeechService;
    TextToSpeechFactory = ttsModule.TextToSpeechFactory;
  });
  
  describe('SilentTextToSpeechService', () => {
    it('should return an empty buffer for synthesizeSpeech', async () => {
      const silentService = new SilentTextToSpeechService();
      const result = await silentService.synthesizeSpeech('Hello world');
      
      expect(Buffer.isBuffer(result)).toBe(true);
      expect(result.length).toBe(0);
    });
  });
  
  describe('OpenAITextToSpeechService', () => {
    it('should be created from the TextToSpeechFactory', () => {
      // We can't create OpenAITextToSpeechService directly as it needs an OpenAI instance
      // So we use the factory that's already configured in the module
      const ttsFactory = TextToSpeechFactory.getInstance();
      const service = ttsFactory.getService('openai');
      
      expect(service).toBeInstanceOf(OpenAITextToSpeechService);
      
      // Check the openai property exists (but we can't access private fields directly)
      expect(service).toBeDefined();
      expect(service.synthesizeSpeech).toBeDefined();
    });
    
    it('should return a Buffer from synthesizeSpeech on silent implementation', async () => {
      // Use the silent implementation which doesn't need external calls
      const silentService = new SilentTextToSpeechService();
      const result = await silentService.synthesizeSpeech("Hello, this is a test");
      
      expect(Buffer.isBuffer(result)).toBe(true);
      expect(result.length).toBe(0); // The silent implementation returns an empty buffer
    });
  });
  
  describe('TextToSpeechFactory', () => {
    it('should be implemented as a singleton', () => {
      const instance1 = TextToSpeechFactory.getInstance();
      const instance2 = TextToSpeechFactory.getInstance();
      
      expect(instance1).toBe(instance2);
    });
    
    it('should return the correct service type based on input', () => {
      const factory = TextToSpeechFactory.getInstance();
      
      const openaiService = factory.getService('openai');
      const browserService = factory.getService('browser');
      const silentService = factory.getService('silent');
      const defaultService = factory.getService('unknown');
      
      expect(openaiService).toBeInstanceOf(OpenAITextToSpeechService);
      expect(browserService).toBeInstanceOf(BrowserSpeechSynthesisService);
      expect(silentService).toBeInstanceOf(SilentTextToSpeechService);
      expect(defaultService).toBeInstanceOf(OpenAITextToSpeechService);
    });
    
    it('should return the same instance for each service type', () => {
      const factory = TextToSpeechFactory.getInstance();
      
      const openaiService1 = factory.getService('openai');
      const openaiService2 = factory.getService('openai');
      const browserService1 = factory.getService('browser');
      const browserService2 = factory.getService('browser');
      
      expect(openaiService1).toBe(openaiService2);
      expect(browserService1).toBe(browserService2);
    });
  });
});