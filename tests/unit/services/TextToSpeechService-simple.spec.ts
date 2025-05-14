/**
 * Simplified tests for the TextToSpeechService
 * 
 * These tests focus on the public API and proper exports
 * of the TextToSpeechService module.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock OpenAI with default export pattern
vi.mock('openai', async (importOriginal) => {
  const MockOpenAI = vi.fn().mockImplementation(() => ({
    audio: {
      speech: {
        create: vi.fn().mockResolvedValue({ 
          arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(128)) 
        }),
      },
    },
  }));
  
  return {
    default: MockOpenAI
  };
});

// Mock environment variables
vi.stubEnv('OPENAI_API_KEY', 'test-api-key');

describe('TextToSpeechService Module Exports', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetModules();
  });

  it('should export the required classes and functions', async () => {
    // Import the module
    const ttsModule = await import('../../../server/services/TextToSpeechService');
    
    // Verify the exports
    expect(typeof ttsModule.TextToSpeechService).toBe('function');
    expect(typeof ttsModule.TTSFactory).toBe('function');
    expect(ttsModule.textToSpeechService).toBeDefined();
    expect(ttsModule.ttsFactory).toBeDefined();
  });

  it('should initialize with the OpenAI client', async () => {
    // Import the module
    await import('../../../server/services/TextToSpeechService');
    
    // Check that OpenAI was called
    const OpenAI = await import('openai');
    expect(OpenAI.default).toHaveBeenCalled();
  });

  it('should synthesize speech using the OpenAI service', async () => {
    // Import the module
    const { textToSpeechService } = await import('../../../server/services/TextToSpeechService');
    
    // Test synthesizeSpeech method
    const text = 'Hello, this is a test';
    const language = 'en-US';
    
    // Call the method
    const result = await textToSpeechService.synthesizeSpeech(text, language);
    
    // Verify the result is a Buffer
    expect(Buffer.isBuffer(result)).toBe(true);
  });

  it('should get a TTS service via the factory', async () => {
    // Import the module
    const { ttsFactory } = await import('../../../server/services/TextToSpeechService');
    
    // Get TTS services for different types
    const openaiService = ttsFactory.getService('openai');
    const browserService = ttsFactory.getService('browser');
    
    // Verify the services have the required method
    expect(typeof openaiService.synthesizeSpeech).toBe('function');
    expect(typeof browserService.synthesizeSpeech).toBe('function');
  });
});