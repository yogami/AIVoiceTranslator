/**
 * Simplified tests for the TextToSpeechService
 * 
 * These tests focus on the public API and proper exports
 * of the TextToSpeechService module.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Always mock at the top level to ensure it's hoisted properly
vi.mock('openai', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      audio: {
        speech: {
          create: vi.fn().mockResolvedValue({ 
            arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(128))
          }),
        },
      },
    })),
  };
});

// No need to mock the module we're testing
vi.stubEnv('OPENAI_API_KEY', 'test-api-key');

describe('TextToSpeechService Module', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('should export the expected interfaces and classes', async () => {
    const ttsModule = await import('../../../server/services/TextToSpeechService');
    
    // Check exports exist
    expect(ttsModule.textToSpeechService).toBeDefined();
    expect(ttsModule.ttsFactory).toBeDefined();
    expect(typeof ttsModule.OpenAITextToSpeechService).toBe('function');
    expect(typeof ttsModule.BrowserSpeechSynthesisService).toBe('function');
    expect(typeof ttsModule.SilentTextToSpeechService).toBe('function');
    expect(typeof ttsModule.TextToSpeechFactory).toBe('function');
  });

  it('should create an OpenAI client when imported', async () => {
    await import('../../../server/services/TextToSpeechService');
    
    // Check OpenAI constructor was called
    const OpenAI = (await import('openai')).default;
    expect(OpenAI).toHaveBeenCalled();
  });
  
  it('should provide a factory with different TTS services', async () => {
    const { ttsFactory } = await import('../../../server/services/TextToSpeechService');
    
    // Get different services
    const openaiService = ttsFactory.getService('openai');
    const browserService = ttsFactory.getService('browser');
    const silentService = ttsFactory.getService('silent');
    
    // Just verify they exist and have required method
    expect(openaiService).toBeDefined();
    expect(browserService).toBeDefined();
    expect(silentService).toBeDefined();
    expect(typeof openaiService.synthesizeSpeech).toBe('function');
    expect(typeof browserService.synthesizeSpeech).toBe('function');
    expect(typeof silentService.synthesizeSpeech).toBe('function');
  });
});