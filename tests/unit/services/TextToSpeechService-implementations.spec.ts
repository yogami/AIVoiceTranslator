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
    it('should initialize with default options', () => {
      const service = new OpenAITextToSpeechService();
      
      // Access private properties using any type
      const serviceAny = service as any;
      expect(serviceAny.openai).toBeDefined();
      expect(serviceAny.defaultOptions).toBeDefined();
      expect(serviceAny.defaultOptions.voice).toBeDefined();
      expect(serviceAny.defaultOptions.model).toBeDefined();
    });
    
    it('should initialize with custom options', () => {
      const customOptions = {
        voice: 'nova',
        model: 'tts-1-hd',
        speed: 1.2
      };
      
      const service = new OpenAITextToSpeechService(customOptions);
      
      // Access private properties using any type
      const serviceAny = service as any;
      expect(serviceAny.defaultOptions.voice).toBe('nova');
      expect(serviceAny.defaultOptions.model).toBe('tts-1-hd');
      expect(serviceAny.defaultOptions.speed).toBe(1.2);
    });
    
    it('should handle synthesizeSpeech with text', async () => {
      const openaiService = new OpenAITextToSpeechService();
      const openai = (await import('openai')).default;
      
      // Reset the mock to track new calls
      const mockCreate = openai.mock.results[0].value.audio.speech.create;
      mockCreate.mockClear();
      
      // Call the method
      await openaiService.synthesizeSpeech('Test speech synthesis');
      
      // Verify OpenAI API was called with correct parameters
      expect(mockCreate).toHaveBeenCalledTimes(1);
      expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({
        input: 'Test speech synthesis',
        voice: expect.any(String),
        model: expect.any(String)
      }));
    });
    
    it('should handle synthesizeSpeech with options object', async () => {
      const openaiService = new OpenAITextToSpeechService();
      const openai = (await import('openai')).default;
      
      // Reset the mock to track new calls
      const mockCreate = openai.mock.results[0].value.audio.speech.create;
      mockCreate.mockClear();
      
      // Call the method with options
      const options = {
        text: 'Test with options',
        voice: 'nova',
        speed: 1.5
      };
      await openaiService.synthesizeSpeech(options);
      
      // Verify OpenAI API was called with correct parameters
      expect(mockCreate).toHaveBeenCalledTimes(1);
      expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({
        input: 'Test with options',
        voice: 'nova',
        speed: 1.5
      }));
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